import { describe, expect, it } from 'vitest';
import { toExportMatrix } from '@cio/utils/export';
import { filterTrainingMatrixEmployees, getTrainingMatrixExportRows } from './training-matrix';
import type { TrainingMatrix } from './types';

describe('training matrix export', () => {
  it('exports only selected employees and plans, preserving zero and missing scores', () => {
    const employees = [
      {
        memberId: 1,
        name: '=张三',
        cells: [
          { planId: 'a', status: 'FAILED', finalScore: 0, certificateExpiringSoon: false },
          { planId: 'b', status: 'COMPLETED', finalScore: 90, certificateExpiringSoon: true }
        ]
      },
      { memberId: 2, name: '李四', cells: [] }
    ] as TrainingMatrix['employees'];
    const plans = [{ id: 'a', name: '安全培训' }] as TrainingMatrix['plans'];
    const selected = filterTrainingMatrixEmployees(employees, '张三', 'a', false);
    const rows = getTrainingMatrixExportRows(selected, plans);
    expect(rows).toEqual([
      { memberId: 1, employeeName: '=张三', planName: '安全培训', status: 'FAILED', finalScore: 0 }
    ]);
    expect(filterTrainingMatrixEmployees(employees, '', 'a', true)).toEqual([]);
    expect(filterTrainingMatrixEmployees(employees, '', '', true)).toHaveLength(1);
    expect(getTrainingMatrixExportRows(employees.slice(1), plans)[0]).toMatchObject({ status: null, finalScore: null });
    const document = {
      filename: 'training',
      title: 'training',
      columns: [
        { key: 'employee', header: '姓名', value: (row: (typeof rows)[number]) => row.employeeName },
        { key: 'score', header: '成绩', value: (row: (typeof rows)[number]) => row.finalScore }
      ],
      rows
    };
    expect(toExportMatrix(document).body).toEqual([['\t=张三', 0]]);
  });
});
