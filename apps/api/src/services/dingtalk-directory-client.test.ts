import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDingtalkDirectory } from '@cio/db/auth/dingtalk';
import type { TDingtalkConfig } from '@cio/utils/validation/auth/dingtalk';

let configuration: TDingtalkConfig;
const root = { dept_id: 1, name: '公司', order: 0 };
const child = { dept_id: 2, parent_id: 1, name: '运营部' };
const employee = { userid: 'staff-a', name: '员工甲', dept_id_list: [1, 2] };

function provider(responseFor: (path: string, fields: Record<string, unknown>) => unknown) {
  const mockedFetch = vi.fn(async (url: string, options: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === '/v1.0/oauth2/accessToken')
      return Response.json({ accessToken: 'directory-test-token', expireIn: 7200 });

    const fields = JSON.parse(String(options.body));
    return Response.json(responseFor(path, fields));
  });
  vi.stubGlobal('fetch', mockedFetch);
  return mockedFetch;
}

describe('DingTalk directory reader', () => {
  beforeEach(() => {
    configuration = {
      corpId: 'company-a',
      clientId: crypto.randomUUID(),
      clientSecret: 'test-secret',
      organizationId: crypto.randomUUID(),
      redirectUri: 'http://localhost:4173/api/auth/dingtalk/callback'
    };
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads nested departments and every page, deduplicating multi-department employees', async () => {
    const requests = provider((path, fields) => {
      if (path.endsWith('/department/get')) return { errcode: 0, result: root };
      if (path.endsWith('/department/listsub')) return { errcode: 0, result: fields.dept_id === 1 ? [child] : [] };
      if (fields.dept_id === 1 && fields.cursor === 0)
        return { errcode: 0, result: { list: [employee], has_more: true, next_cursor: 100 } };
      if (fields.dept_id === 1)
        return {
          errcode: 0,
          result: { list: [{ userid: 'staff-b', name: '员工乙', dept_id_list: [1] }], has_more: false }
        };

      return { errcode: 0, result: { list: [{ ...employee, dept_id_list: [2, 1] }], has_more: false } };
    });
    const directory = await getDingtalkDirectory(configuration);
    expect(directory.departments).toEqual([
      { id: 1, parentId: 0, name: '公司', sort: 0 },
      { id: 2, parentId: 1, name: '运营部', sort: 0 }
    ]);
    expect(directory.employees).toHaveLength(2);
    expect(directory.employees[0].departmentIds).toEqual([1, 2]);
    const pageBodies = requests.mock.calls
      .filter(([url]) => url.includes('/user/list'))
      .map(([, options]) => JSON.parse(String(options.body)));
    expect(pageBodies.map((body) => body.cursor)).toEqual([0, 100, 0]);
    expect(pageBodies.every((body) => body.size === 100 && body.contain_access_limit === false)).toBe(true);
  });

  it('surfaces missing permissions without leaking the provider response', async () => {
    provider(() => ({ errcode: 88, errmsg: 'requiredScopes=[qyapi_get_department_list]' }));
    await expect(getDingtalkDirectory(configuration)).rejects.toMatchObject({
      code: 'permissions',
      message: 'permissions'
    });
  });

  it.each(['cycle', 'wrong_parent', 'repeated_cursor', 'wrong_employee_department', 'changed_employee'])(
    'rejects an inconsistent directory: %s',
    async (condition) => {
      provider((path, fields) => {
        if (path.endsWith('/department/get')) return { errcode: 0, result: root };
        if (path.endsWith('/department/listsub')) {
          const children =
            condition === 'cycle'
              ? [{ ...root, parent_id: 1 }]
              : fields.dept_id === 1
                ? [{ ...child, parent_id: condition === 'wrong_parent' ? 9 : 1 }]
                : [];
          return { errcode: 0, result: children };
        }

        const row = {
          ...employee,
          name: condition === 'changed_employee' && fields.dept_id === 2 ? '不同的人' : employee.name,
          dept_id_list: condition === 'wrong_employee_department' ? [9] : [1, 2]
        };
        return { errcode: 0, result: { list: [row], has_more: condition === 'repeated_cursor', next_cursor: 0 } };
      });
      await expect(getDingtalkDirectory(configuration)).rejects.toMatchObject({ code: 'invalid_directory' });
    }
  );
});
