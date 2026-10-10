import {
  DingtalkDirectoryError,
  getDingtalkConfig,
  getDingtalkDirectory,
  isActiveDingtalkMember
} from '@cio/db/auth/dingtalk';
import {
  readDingtalkDirectoryState,
  saveDingtalkDirectoryPreview,
  withDingtalkDirectoryPreview,
  finishDingtalkDirectoryPreview,
  applyDingtalkDirectoryDepartments,
  createDingtalkDirectoryEmployees,
  updateDingtalkDirectoryEmployee
} from '@cio/db/queries/enterprise/dingtalk-directory';
import {
  ZDingtalkDirectory,
  ZDingtalkDirectorySnapshot,
  type TDingtalkDirectory,
  type TDingtalkDirectorySync
} from '@cio/utils/validation/auth/dingtalk';
import { AppError, ErrorCodes } from '@api/utils/errors';
import { ROLE } from '@cio/utils/constants';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  directoryAccountKey,
  directoryEmailAddresses,
  directoryRevision,
  planDingtalkDirectory,
  type DirectoryState
} from './dingtalk-directory-plan';
import { getEnterpriseOverview } from './enterprise';
import { assertStudentCapacityOrThrow } from './organization/student-limit';

function directoryError(code: string, status = 400) {
  return new AppError(code, `DINGTALK_DIRECTORY_${code.toUpperCase()}`, status);
}

async function requireDingtalkAdmin(organizationId: string, profileId: string) {
  const overview = await getEnterpriseOverview(organizationId, profileId);
  if (!overview.isSuperAdmin)
    throw new AppError('Organization admin access required', ErrorCodes.ORG_TEAM_NOT_AUTHORIZED, 403);

  return overview;
}

function configuredOrganization(organizationId: string) {
  const configuration = getDingtalkConfig();
  if (!configuration || configuration.organizationId !== organizationId) throw directoryError('disabled');

  return configuration;
}

function requireCurrentAdmin(state: DirectoryState, profileId: string) {
  const current = state.members.find((row) => row.member.profileId === profileId);
  const superAdmin =
    current &&
    (current.member.roleId === ROLE.ADMIN ||
      state.roles.some((row) => row.memberId === current.member.id && row.role === 'SUPER_ADMIN'));
  if (
    !current ||
    !superAdmin ||
    !current.user ||
    !isActiveDingtalkMember({ member: current.member, user: current.user })
  )
    throw directoryError('changed', 409);
}

export async function getDingtalkDirectoryStatus(organizationId: string, profileId: string) {
  const overview = await getEnterpriseOverview(organizationId, profileId);
  const configuration = getDingtalkConfig();
  const enabled = configuration?.organizationId === organizationId;
  return { enabled, canSync: overview.isSuperAdmin, callbackUrl: enabled ? configuration.redirectUri : null };
}

export async function previewDingtalkDirectory(organizationId: string, profileId: string) {
  await requireDingtalkAdmin(organizationId, profileId);
  const configuration = configuredOrganization(organizationId);
  let directory;
  try {
    directory = await getDingtalkDirectory(configuration);
  } catch (error) {
    const code = error instanceof DingtalkDirectoryError ? error.code : 'provider_error';
    throw directoryError(code, 400);
  }

  return prepareDingtalkDirectoryPreview(organizationId, profileId, directory);
}

export async function prepareDingtalkDirectoryPreview(
  organizationId: string,
  profileId: string,
  sourceDirectory: TDingtalkDirectory
) {
  await requireDingtalkAdmin(organizationId, profileId);
  const configuration = configuredOrganization(organizationId);
  const directory = ZDingtalkDirectory.parse(sourceDirectory);
  const emails = directoryEmailAddresses(directory);
  const state = await readDingtalkDirectoryState(organizationId, emails);
  requireCurrentAdmin(state, profileId);
  const source = `dingtalk:${configuration.corpId}`;
  if (state.departments.some((row) => row.externalSource === source && row.status === 'INACTIVE'))
    throw directoryError('invalid_directory');

  const plan = planDingtalkDirectory(directory, state, configuration.corpId);
  const token = randomBytes(32).toString('hex');
  const revision = directoryRevision(state);
  const snapshot = {
    organizationId,
    profileId,
    corpId: configuration.corpId,
    revision,
    directory,
    result: null,
    selectionHash: null
  };
  await saveDingtalkDirectoryPreview(token, snapshot);
  return { token, ...plan };
}

export async function syncDingtalkDirectory(organizationId: string, profileId: string, values: TDingtalkDirectorySync) {
  await requireDingtalkAdmin(organizationId, profileId);
  const configuration = configuredOrganization(organizationId);
  const selections = [...values.selections].sort((left, right) => left.userId.localeCompare(right.userId));
  const selectionHash = createHash('sha256').update(JSON.stringify(selections)).digest('hex');
  return withDingtalkDirectoryPreview(organizationId, profileId, values.token, async (client, stored) => {
    if (!stored) throw directoryError('expired', 409);

    const parsed = ZDingtalkDirectorySnapshot.safeParse(JSON.parse(stored.value));
    if (!parsed.success) throw directoryError('expired', 409);

    const snapshot = parsed.data;
    if (
      snapshot.organizationId !== organizationId ||
      snapshot.profileId !== profileId ||
      snapshot.corpId !== configuration.corpId
    )
      throw directoryError('changed', 409);

    const emails = directoryEmailAddresses(snapshot.directory);
    const state = await readDingtalkDirectoryState(organizationId, emails, client);
    requireCurrentAdmin(state, profileId);
    if (snapshot.result) {
      if (snapshot.selectionHash !== selectionHash) throw directoryError('changed', 409);

      return snapshot.result;
    }

    if (directoryRevision(state) !== snapshot.revision) throw directoryError('changed', 409);

    const plan = planDingtalkDirectory(snapshot.directory, state, configuration.corpId);
    const selectedEmployees = selections.map((selection) => {
      const employee = plan.employees.find((row) => row.userId === selection.userId);
      if (
        !employee ||
        !['ready', 'department_required'].includes(employee.status) ||
        !employee.departmentIds.includes(selection.departmentId)
      )
        throw directoryError('changed', 409);

      return { ...employee, departmentId: selection.departmentId };
    });
    const source = `dingtalk:${configuration.corpId}`;
    const departmentIds = new Map(plan.departments.map((row) => [row.id, row.localId ?? randomUUID()]));
    const departmentRows = plan.departments.map((row) => {
      const existing = state.departments.find((item) => item.id === row.localId);
      const id = departmentIds.get(row.id)!;
      const externalId = String(row.id);
      const parentId = row.parentId === 0 ? null : departmentIds.get(row.parentId);
      if (parentId === undefined) throw directoryError('invalid_directory');

      return {
        id,
        organizationId,
        name: row.name,
        parentId,
        sort: row.sort,
        code: existing?.code ?? `DD-${row.id}`,
        externalSource: source,
        externalId
      };
    });
    if (
      departmentRows.some((row) =>
        state.departments.some((existing) => existing.code === row.code && existing.id !== row.id)
      )
    )
      throw directoryError('changed', 409);

    const newEmployees = selectedEmployees.filter((row) => row.action === 'create');
    await assertStudentCapacityOrThrow(organizationId, newEmployees.length, client, { deferNotification: true });
    await applyDingtalkDirectoryDepartments(client, departmentRows);
    const users = newEmployees.map((row) => {
      const id = randomUUID();
      const accountKey = directoryAccountKey(configuration.corpId, row.userId);
      const email = row.companyEmail ?? `${accountKey}@zz-train.invalid`;
      return { id, name: row.name, email, emailVerified: false, isAnonymous: false };
    });
    const profiles = newEmployees.map((row, index) => {
      const accountKey = directoryAccountKey(configuration.corpId, row.userId);
      return {
        id: users[index].id,
        fullname: row.name,
        username: `dd-${accountKey}`,
        email: row.companyEmail,
        source,
        locale: 'zh' as const,
        canAddCourse: false
      };
    });
    const members = newEmployees.map((row, index) => {
      const departmentId = departmentIds.get(row.departmentId)!;
      return {
        organizationId,
        profileId: users[index].id,
        roleId: ROLE.STUDENT,
        email: row.companyEmail,
        employeeNo: row.employeeNo,
        position: row.position,
        departmentId,
        externalSource: source,
        externalId: row.userId,
        employmentStatus: 'ACTIVE' as const
      };
    });
    await createDingtalkDirectoryEmployees(client, users, profiles, members);
    for (const employee of selectedEmployees.filter((row) => row.action === 'update')) {
      const existing = state.members.find((row) => row.member.id === employee.memberId)!;
      const email = employee.companyEmail ?? existing.member.email;
      const departmentId = departmentIds.get(employee.departmentId)!;
      await updateDingtalkDirectoryEmployee(
        client,
        organizationId,
        existing.member.id,
        existing.member.profileId!,
        employee.name,
        { email, employeeNo: employee.employeeNo, position: employee.position, departmentId }
      );
    }

    const departmentsCreated = plan.departments.filter((row) => row.action === 'create').length;
    const departmentsUpdated = plan.departments.length - departmentsCreated;
    const result = {
      departmentsCreated,
      departmentsUpdated,
      employeesCreated: newEmployees.length,
      employeesUpdated: selectedEmployees.length - newEmployees.length
    };
    await finishDingtalkDirectoryPreview(client, stored.id, { ...snapshot, selectionHash, result });
    return result;
  });
}
