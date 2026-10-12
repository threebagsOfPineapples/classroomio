import { auth } from '@cio/db/auth';
import { getDingtalkConfig, isActiveDingtalkMember } from '@cio/db/auth/dingtalk';
import { getDingtalkMember } from '@cio/db/queries/auth/dingtalk';
import {
  findLoginEmailOwner,
  getCredentialAccount,
  lockLoginUser,
  saveLoginEmail,
  setCredentialPassword,
  withLoginAccountTransaction
} from '@cio/db/queries/auth';
import { AppError, ErrorCodes } from '@api/utils/errors';
import { getPostgresError } from '@cio/utils/errors';
import { ZChangeLoginEmail, type TChangeLoginEmail } from '@cio/utils/validation/account';
import { env } from '@cio/core/config/env';

export async function changeLoginEmail(userId: string, fields: TChangeLoginEmail) {
  if (env.PUBLIC_IS_SELFHOSTED !== 'true') {
    throw new AppError('This account setting is only available in self-hosted mode', ErrorCodes.FORBIDDEN, 403);
  }

  const data = ZChangeLoginEmail.parse(fields);
  const context = await auth.$context;

  try {
    return await withLoginAccountTransaction(async (client) => {
      const loginUser = await lockLoginUser(userId, client);
      if (
        !loginUser ||
        loginUser.isAnonymous ||
        (loginUser.banned && (!loginUser.banExpires || loginUser.banExpires > new Date()))
      ) {
        throw new AppError('settings.profile.login_account.identity_required', ErrorCodes.FORBIDDEN, 403);
      }

      const credential = await getCredentialAccount(userId, client);
      if (credential?.password) {
        const passwordValid = data.currentPassword
          ? await context.password.verify({ hash: credential.password, password: data.currentPassword })
          : false;
        if (!passwordValid) {
          throw new AppError(
            'settings.profile.login_account.incorrect_password',
            ErrorCodes.VALIDATION_ERROR,
            400,
            'currentPassword'
          );
        }

        if (data.newPassword) {
          throw new AppError(
            'settings.profile.login_account.use_current_password',
            ErrorCodes.VALIDATION_ERROR,
            400,
            'currentPassword'
          );
        }
      } else {
        const config = getDingtalkConfig();
        const members = config ? await getDingtalkMember(config.organizationId, userId, client) : [];
        const [member] = members;
        const activeIdentity =
          config &&
          member?.member.externalSource === `dingtalk:${config.corpId}` &&
          member.member.externalId &&
          isActiveDingtalkMember(member);
        if (!activeIdentity) {
          throw new AppError('settings.profile.login_account.identity_required', ErrorCodes.FORBIDDEN, 403);
        }

        if (!data.newPassword) {
          throw new AppError(
            'settings.profile.login_account.password_required',
            ErrorCodes.VALIDATION_ERROR,
            400,
            'newPassword'
          );
        }
      }

      const owner = await findLoginEmailOwner(userId, data.newEmail, client);
      if (owner) {
        throw new AppError('settings.profile.login_account.email_exists', ErrorCodes.CONFLICT, 409, 'newEmail');
      }

      const updatedProfile = await saveLoginEmail(userId, data.newEmail, client);
      if (!updatedProfile) {
        throw new AppError('Profile not found', ErrorCodes.PROFILE_NOT_FOUND, 404);
      }

      if (!credential?.password && data.newPassword) {
        const passwordHash = await context.password.hash(data.newPassword);
        await setCredentialPassword(userId, passwordHash, client);
      }

      return { profile: updatedProfile, hasCredentialPassword: true };
    });
  } catch (error) {
    const postgresError = getPostgresError(error);
    if (postgresError?.code === '23505') {
      throw new AppError('settings.profile.login_account.email_exists', ErrorCodes.CONFLICT, 409, 'newEmail');
    }

    if (postgresError?.code === '40001') {
      throw new AppError('settings.profile.login_account.retry', ErrorCodes.CONFLICT, 409);
    }

    throw error;
  }
}
