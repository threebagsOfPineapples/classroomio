const pageNames = {
  workbench: '培训工作台',
  tracking: '学习追踪',
  people: '组织与员工',
  courses: '课程管理',
  plan: '培训计划',
  exam: '考试管理',
  survey: '问卷与评价',
  attendance: '线下签到',
  mentoring: '导师带教',
  automation: '自动派课与督学',
  reports: '报表中心',
  permissions: '权限与操作记录',
  executive: '总部学习大盘',
  mentor: '我的带教',
  learner: '我的学习',
  learning: '课程学习',
  'learner-exam': '在线考试',
  'learner-signin': '扫码签到',
  'learner-survey': '课后评价',
  'learner-archive': '我的进度',
  'learner-mentoring': '我的带教任务'
};
const currentPage = document.body.dataset.page || 'index';
const searchParams = new URLSearchParams(location.search);
const role = currentPage === 'manager' ? 'manager' : searchParams.get('role') || 'training';
const departments = ['客服一部', '客服二部', '剪辑部', '主播部', '货架电商'];
const personNames = [
  '张楠',
  '陈晴',
  '王晨',
  '赵敏',
  '周悦',
  '刘航',
  '孙宁',
  '许安',
  '李珂',
  '林夏',
  '徐宇',
  '郑可',
  '陈诺',
  '杨禾',
  '吴桐',
  '何予',
  '宋佳',
  '梁辰',
  '苏宁',
  '唐星',
  '朱言',
  '程思',
  '谢雨',
  '董一'
];
const progressValues = [
  0, 35, 100, 75, 0, 100, 60, 100, 25, 100, 100, 0, 95, 15, 100, 50, 0, 100, 80, 100, 45, 0, 100, 70
];
const scoreValues = [
  null,
  null,
  88,
  null,
  null,
  55,
  null,
  92,
  null,
  78,
  84,
  null,
  null,
  null,
  59,
  null,
  null,
  90,
  null,
  76,
  null,
  null,
  81,
  null
];
const employees = personNames.map((name, employeeIndex) => {
  const departmentIndex = employeeIndex % departments.length;
  return {
    id: 'ZZ' + String(employeeIndex + 1).padStart(4, '0'),
    name,
    department: departments[departmentIndex],
    position: ['客服专员', '客服专员', '剪辑师', '主播', '电商运营'][departmentIndex],
    jobType: ['客服', '客服', '剪辑', '主播', '货架电商'][departmentIndex],
    progress: progressValues[employeeIndex],
    score: scoreValues[employeeIndex],
    mentor: employeeIndex % 2 ? '李师傅' : '赵师傅',
    lastLearning: progressValues[employeeIndex] === 0 ? '—' : '10-11 ' + (employeeIndex % 2 ? '19:42' : '09:18'),
    certified: employeeIndex === 2 || employeeIndex === 7 || employeeIndex === 9,
    reminded: false,
    signedIn: employeeIndex < 6 && employeeIndex !== 1
  };
});
const prototypeState = {
  department: role === 'manager' ? '客服一部' : '全部部门',
  position: '全部岗位',
  jobType: '全部工种',
  search: '',
  status: 'all',
  scenario: 'normal',
  selectedIds: new Set(),
  planStep: 0,
  playingSeconds: 84,
  answer: '',
  examSubmitted: false,
  surveySubmitted: false,
  eventClosed: false,
  mentorReview: null
};
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  book: '<path d="M4 3h7c2 0 3 1 3 3v15c-1-1-2-2-4-2H4zM20 3h-6M14 19h6V3"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2"/>',
  chart: '<path d="M4 3v18h17M8 16v-5M13 16V6M18 16V9"/>',
  list: '<path d="M8 5h13M8 12h13M8 19h13M3 4v2M3 11v2M3 18v2"/>',
  check: '<path d="m4 12 5 5L20 5"/>',
  settings:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>'
};
function icon(name) {
  return `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.list}</svg>`;
}
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
function link(page, label, className = '') {
  return `<a class="${className}" href="${page}.html${role === 'manager' ? '?role=manager' : ''}">${label}</a>`;
}
function button(label, action, primary = false, extra = '') {
  return `<button class="${primary ? 'primary' : ''}" data-action="${action}" ${extra}>${label}</button>`;
}
function badge(label, color = '') {
  return `<span class="badge ${color}">${label}</span>`;
}
function visibleEmployees() {
  return employees.filter(
    (employee) =>
      (role !== 'manager' || employee.department === '客服一部') &&
      (prototypeState.department === '全部部门' || employee.department === prototypeState.department) &&
      (prototypeState.position === '全部岗位' || employee.position === prototypeState.position) &&
      (prototypeState.jobType === '全部工种' || employee.jobType === prototypeState.jobType) &&
      (!prototypeState.search || (employee.name + employee.id).includes(prototypeState.search))
  );
}
function filteredEmployees() {
  return visibleEmployees().filter(
    (employee) =>
      prototypeState.status === 'all' ||
      (prototypeState.status === 'not-started' && employee.progress === 0) ||
      (prototypeState.status === 'in-progress' && employee.progress > 0 && employee.progress < 100) ||
      (prototypeState.status === 'complete' && employee.progress === 100) ||
      (prototypeState.status === 'failed' && employee.score !== null && employee.score < 60)
  );
}
function metricsMarkup(records) {
  const started = records.filter((employee) => employee.progress > 0).length;
  const completed = records.filter((employee) => employee.progress === 100).length;
  const examined = records.filter((employee) => employee.score !== null).length;
  const passed = records.filter((employee) => employee.score !== null && employee.score >= 60).length;
  const percent = (numerator, denominator) => (denominator ? ((numerator / denominator) * 100).toFixed(1) : '—');
  return `<div class="metrics">
    <div class="metric"><p>已开始学习</p><strong>${started}<span>人</span></strong><small>已派课 ${records.length} 人，未学 ${records.length - started} 人</small></div>
    <div class="metric"><p>学习完成率</p><strong>${percent(completed, records.length)}<span>%</span></strong><small>已学完 ${completed} / 应学 ${records.length} 人</small></div>
    <div class="metric"><p>考试合格率</p><strong>${percent(passed, examined)}<span>%</span></strong><small>及格 ${passed} / 已出正式分 ${examined} 人</small></div>
    <div class="metric"><p>未参加考试</p><strong>${records.length - examined}<span>人</span></strong><small>已参加 ${examined} / 应考 ${records.length} 人</small></div>
  </div>`;
}
function heading(title, description, actions = '') {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><div class="actions">${actions}</div></div>`;
}
function panel(title, body, action = '') {
  return `<section class="panel"><div class="panel-heading"><h2>${title}</h2>${action}</div>${body}</section>`;
}
function filtersMarkup() {
  const departmentOptions = (role === 'manager' ? ['客服一部'] : ['全部部门', ...departments])
    .map((department) => `<option ${prototypeState.department === department ? 'selected' : ''}>${department}</option>`)
    .join('');
  const positions = [
    '全部岗位',
    ...new Set(
      employees
        .filter((employee) => role !== 'manager' || employee.department === '客服一部')
        .map((employee) => employee.position)
    )
  ];
  return `<div class="filters"><label>部门<select data-field="department" ${role === 'manager' ? 'disabled' : ''}>${departmentOptions}</select></label><label>岗位<select data-field="position">${positions.map((position) => `<option ${prototypeState.position === position ? 'selected' : ''}>${position}</option>`).join('')}</select></label><label>工种<select data-field="jobType">${['全部工种', '客服', '剪辑', '主播', '货架电商'].map((jobType) => `<option ${prototypeState.jobType === jobType ? 'selected' : ''}>${jobType}</option>`).join('')}</select></label><label>人员<input data-field="search" aria-label="搜索姓名或工号" placeholder="姓名或工号，回车搜索" value="${escapeHtml(prototypeState.search)}"></label></div>`;
}
function learningTable(records, compact = false) {
  return `<div class="table-scroll"><table><thead><tr>${compact ? '' : '<th><input type="checkbox" data-action="select-all" aria-label="选择全部筛选结果"></th>'}<th>员工</th><th>部门 / 岗位</th><th>学习进度</th><th>最近学习</th><th>考试分</th><th>考核结果</th>${compact ? '' : '<th>导师认证</th><th>最近催学</th>'}<th>操作</th></tr></thead><tbody>${
    records
      .map(
        (employee) => `<tr>
    ${compact ? '' : `<td><input type="checkbox" aria-label="选择${employee.name}" data-employee="${employee.id}" ${prototypeState.selectedIds.has(employee.id) ? 'checked' : ''}></td>`}
    <td><a class="person-name" href="#" data-action="employee-detail" data-id="${employee.id}">${employee.name}</a><small>${employee.id}</small></td>
    <td>${employee.department}<small>${employee.position} / ${employee.jobType}</small></td>
    <td>${employee.progress}% ${badge(employee.progress === 0 ? '未学' : employee.progress === 100 ? '已学完' : '学习中', employee.progress === 100 ? 'green' : employee.progress === 0 ? '' : 'blue')}<div class="progress-track"><i style="width:${employee.progress}%"></i></div></td>
    <td>${employee.lastLearning}</td><td>${employee.score ?? '—'}</td><td>${badge(employee.score === null ? '未参加' : employee.score >= 60 ? '合格' : '不合格', employee.score === null ? '' : employee.score >= 60 ? 'green' : 'red')}</td>
    ${compact ? '' : `<td>${badge(employee.certified ? '已认证' : '待认证', employee.certified ? 'green' : '')}</td><td>${employee.reminded ? '今天（演示）' : '—'}</td>`}
    <td>${button('查看', 'employee-detail', false, `data-id="${employee.id}"`)}</td></tr>`
      )
      .join('') ||
    '<tr><td colspan="10"><div class="empty"><h3>没有符合条件的学员</h3><p>调整部门、工种或学习状态后再试。</p></div></td></tr>'
  }</tbody></table></div>`;
}
function trackingMarkup() {
  const records = visibleEmployees();
  const tabs = [
    ['all', '全部', records.length],
    ['not-started', '未学', records.filter((employee) => employee.progress === 0).length],
    ['in-progress', '学习中', records.filter((employee) => employee.progress > 0 && employee.progress < 100).length],
    ['complete', '已学完', records.filter((employee) => employee.progress === 100).length],
    ['failed', '考核不合格', records.filter((employee) => employee.score !== null && employee.score < 60).length]
  ];
  return (
    heading(
      '学习追踪',
      role === 'manager' ? '本部门人员的学习、考试与带教情况' : '先找到未学与未达标人员，再查看证据、催学或导出',
      button('导出筛选名单', 'export')
    ) +
    `<div class="alert">当前培训：新人通用培训（演示）　截止 10 月 14 日　及格线 60 分。学习完成与考核合格分别计算。</div>` +
    `<section class="panel">${filtersMarkup()}<div class="tabs">${tabs.map(([status, title, count]) => `<button data-status="${status}" aria-pressed="${prototypeState.status === status}">${title} ${count}</button>`).join('')}</div><div class="bulk"><span>已选择 <strong>${prototypeState.selectedIds.size}</strong> 人</span><div class="actions">${button('催学筛选结果', 'remind-filtered', true)}${button('催学已选人员', 'remind-selected')}${button('导出名单', 'export')}</div></div>${learningTable(filteredEmployees())}<p class="notice">当前展示 ${filteredEmployees().length} 名虚构学员。岗位、工种与部门分别展示；空分数表示未参加，不能视为 0 分。</p></section>`
  );
}
function workbenchMarkup() {
  const records = visibleEmployees();
  const notStarted = records.filter((employee) => employee.progress === 0).length;
  const failed = records.filter((employee) => employee.score !== null && employee.score < 60).length;
  return (
    heading(
      role === 'manager' ? '本部门培训' : '培训工作台',
      role === 'manager'
        ? '客服一部；可见范围按授权部门确定'
        : '总部范围 621 人 / 19 部门（需求口径）；以下为 24 人演示',
      role === 'manager' ? '' : link('plan', '新建培训计划', 'button primary')
    ) +
    metricsMarkup(records) +
    `<div class="split">${panel('优先处理', `<div class="queue-row"><div><strong>${notStarted} 人尚未开始学习</strong><p>新人通用培训，距离截止还有 2 天</p></div>${link('tracking', '查看未学人员', 'button')}</div><div class="queue-row"><div><strong>${failed} 人考核不合格</strong><p>学习已完成，仍需补考或复训</p></div>${link('exam', '查看考核', 'button')}</div><div class="queue-row"><div><strong>2 项带教任务待点评</strong><p>实操记录已提交，等待导师确认</p></div>${link('mentoring', '查看带教', 'button')}</div>`, link('tracking', '全部学习记录'))}
    ${panel('本期培训', `<div class="task-row"><div><strong>新人通用培训</strong><p>10-01 至 10-14 / 视频、文档与考试</p></div>${badge('进行中', 'blue')}</div><div class="task-row"><div><strong>客服双班微课</strong><p>单节 3–5 分钟 / 早晚班分别提醒</p></div>${badge('草稿')}</div><p class="notice">提醒只发给应学且未完成的人；离职、停用人员不进入新提醒。</p>`, link('plan', '查看计划'))}</div>` +
    panel('需要跟进的人员', learningTable(records.filter((employee) => employee.progress < 60).slice(0, 5), true))
  );
}
function peopleMarkup() {
  return (
    heading(
      '组织与员工',
      '部门、岗位、工种与班次分别维护；集团通讯录先限定总部范围',
      button('导入员工', 'import-preview', true)
    ) +
    `<div class="alert">总部统计口径：621 人 / 19 部门。钉钉实际目录人数可能不同，先核对部门 ID 与名单，不按人数强行裁剪。</div>` +
    panel(
      '员工目录',
      filtersMarkup() +
        `<div class="actions" style="margin-bottom:16px">${button('钉钉同步预览', 'directory-preview')}${button('批量设置工种 / 班次', 'group-preview')}${button('导出人员', 'export')}</div><div class="table-scroll"><table><thead><tr><th>姓名 / 工号</th><th>部门</th><th>岗位</th><th>工种 / 班次</th><th>导师</th><th>账号状态</th></tr></thead><tbody>${visibleEmployees()
          .map(
            (employee) =>
              `<tr><td>${employee.name}<small>${employee.id}</small></td><td>${employee.department}</td><td>${employee.position}</td><td>${employee.jobType}<small>${employee.jobType === '客服' ? '早班 / 晚班按本人排班' : '常规班次'}</small></td><td>${employee.mentor}</td><td>${badge('在职', 'green')}</td></tr>`
          )
          .join('')}</tbody></table></div>`
    )
  );
}
function coursesMarkup() {
  return (
    heading(
      '课程管理',
      '上传第一份资料即可开始；课程逐步沉淀，微课按 3–5 分钟组织',
      button('新建课程', 'create-course', true)
    ) +
    panel(
      '内部课程',
      `<div class="actions" style="margin-bottom:16px">${button('查看空库启动', 'empty-library')}${button('批量上传素材', 'upload-preview')}</div>` +
        [
          ['认识公司与岗位', '文档', 'PDF / 18 页', '已发布'],
          ['客服交接三件事', '微课', '视频 / 03:40', '草稿'],
          ['剪辑交付前自检', '微课', '视频 / 04:20', '草稿']
        ]
          .map(
            ([name, format, note, status]) =>
              `<div class="course-row"><div class="course-glyph">${format}</div><div class="course-info"><strong>${name}（演示）</strong><p>${note}；未使用真实课程资源</p></div>${badge(status, status === '已发布' ? 'green' : '')}${button('查看学习要求', 'course-policy')}</div>`
          )
          .join('')
    ) +
    panel(
      '资源与发布检查',
      '<p>素材上传后先检查可预览、可追踪及转码状态，再发布。封面、标签、时长、适用岗位与学员范围一次设置，发布课程后在计划中派课。</p><p class="notice">当前界面稿只使用课程名称和资源类型示例，没有上传或复制参考平台课程。</p>'
    )
  );
}
function planMarkup() {
  const steps = ['基本信息', '选择课程与考核', '选择人员', '提醒与导师', '发布核对'];
  let content = '';
  if (prototypeState.planStep === 0)
    content = `<div class="form-grid"><label class="field">培训名称<input value="新人通用培训（演示）"></label><label class="field">培训方式<select><option>线上自学</option><option>线上与线下结合</option></select></label><label class="field">开始日期<input type="date" value="2026-10-01"></label><label class="field">截止日期<input type="date" value="2026-10-14"></label></div><label class="field">学习要求<textarea>完成指定课程、参加考试，实操任务由导师点评与认证。</textarea></label>`;
  if (prototypeState.planStep === 1)
    content = `<div class="task-row"><div><strong>认识公司与岗位（演示）</strong><p>文档学习；完成阅读要求后计入进度</p></div>${badge('必修', 'orange')}</div><div class="task-row"><div><strong>新人基础知识考试（演示）</strong><p>满分 100 分，及格 60 分，客观题自动判分</p></div>${badge('考试', 'blue')}</div><div class="alert">空库时可保存草稿；课程尚未发布或上传未完成时，不能发布派课。</div>`;
  if (prototypeState.planStep === 2)
    content = `<div class="form-grid"><label class="field">部门<select><option>客服一部</option><option>剪辑部</option></select></label><label class="field">岗位<select><option>客服专员</option></select></label></div><div class="alert">匹配规则：部门 = 客服一部 且 岗位 = 客服专员。发布前显示具体员工名单。</div>${learningTable(
      employees.filter((employee) => employee.department === '客服一部'),
      true
    )}`;
  if (prototypeState.planStep === 3)
    content = `<ul class="policy-list"><li><input type="checkbox" checked id="plan-reminder"><label for="plan-reminder">对未学和进度滞后人员自动提醒<small style="display:block">每天最多一次；客服人员按早晚班提醒窗口执行</small></label></li><li><input type="checkbox" checked id="plan-mentor"><label for="plan-mentor">沿用已绑定导师；缺少导师时进入待处理队列</label></li></ul><label class="field" style="margin-top:16px">提醒渠道<select><option>站内 + 钉钉工作通知</option><option>仅站内</option></select></label>`;
  if (prototypeState.planStep === 4)
    content =
      '<h3>发布前确认</h3><p>本次面向客服一部客服专员，共 5 名演示学员。课程、考试和导师任务分别保留完成记录。</p><ul><li>课程与试卷版本在发布时固定</li><li>执行范围在发布前再次校验</li><li>派课成功与通知送达分别记录</li></ul>';
  return (
    heading(
      '新建培训计划',
      '批量派课前预览名单，发布后保留人员与内容快照',
      link('tracking', '查看现有学习记录', 'button')
    ) +
    panel(
      '计划设置',
      `<div class="stepper">${steps.map((step, index) => `<span class="${index === prototypeState.planStep ? 'current' : ''}">${index + 1}. ${step}</span>`).join('')}</div>${content}<div class="form-footer">${button('上一步', 'plan-back', false, prototypeState.planStep === 0 ? 'disabled' : '')}${button(prototypeState.planStep === 4 ? '模拟发布计划' : '下一步', prototypeState.planStep === 4 ? 'plan-publish' : 'plan-next', true)}</div>`
    )
  );
}
function examMarkup() {
  return (
    heading('考试管理', '题库选题、试卷设计、考试安排与成绩分开管理', button('新建考试', 'exam-create', true)) +
    `<div class="split">${panel('新人基础知识考试（演示）', '<div class="score-line"><span>考试窗口</span><strong>10-01 至 10-14</strong></div><div class="score-line"><span>时长 / 及格线</span><strong>30 分钟 / 60 分</strong></div><div class="score-line"><span>题型</span><strong>单选、多选、判断</strong></div><div class="score-line"><span>未参加 / 不合格</span><strong>15 人 / 2 人</strong></div><div class="actions" style="margin-top:18px">' + button('编辑试卷', 'paper-edit') + button('批量安排补考', 'makeup') + link('learner-exam', '预览答题', 'button') + '</div>')}
    ${panel('基础考试防作弊', '<ul class="policy-list"><li><input type="checkbox" checked id="exam-shuffle"><label for="exam-shuffle">题目、选项乱序</label></li><li><input type="checkbox" checked id="exam-switch"><label for="exam-switch">离开页面记录次数并提示</label></li><li><input type="checkbox" checked id="exam-time"><label for="exam-time">退出继续计时，服务端判定截止</label></li></ul><p class="notice">异常只形成证据与按规则处置，不把普通来电直接判定为作弊；正式考试前向学员展示规则。</p>')}</div>` +
    panel(
      '成绩与补考',
      learningTable(
        visibleEmployees().filter((employee) => employee.score !== null),
        true
      )
    )
  );
}
function surveyMarkup() {
  return (
    heading(
      '问卷与评价',
      '培训需求调研与课后评价独立发布，按部门或人员定向发放',
      button('创建问卷', 'survey-create', true)
    ) +
    `<div class="split">${panel('培训需求调研（演示）', '<p>对象：客服一部、客服二部</p><p>问题：希望补充的技能、可学习时段、目前遇到的困难。</p><div class="actions">' + button('预览问卷', 'survey-preview') + button('发布与选人', 'survey-target') + '</div><p class="notice">匿名问卷仅展示回收统计与汇总答案，提醒依据独立的参与记录。</p>')}
    ${panel('新人课程课后评价（演示）', '<p>满意度评分 + 改进建议；支持课后海报二维码入口。</p><div class="qr-placeholder"><strong>评价二维码</strong><p>设计占位，不可扫码</p></div><div class="actions">' + link('learner-survey', '手机评价预览', 'button primary') + button('导出回收记录', 'domain-export', false, 'data-domain="问卷"') + '</div>')}</div>` +
    panel(
      '回收统计',
      '<div class="score-line"><span>定向人数（演示）</span><strong>24 人</strong></div><div class="score-line"><span>已回收（演示）</span><strong>12 份 / 50.0%</strong></div><p class="notice">回收率 = 已提交人数 / 有效受邀人数；匿名答案不提供按员工反查入口。</p>'
    )
  );
}
function attendanceMarkup() {
  const signedCount = employees.filter((employee) => employee.signedIn).length;
  return (
    heading(
      '线下签到',
      '场次绑定应到名单，签到结束后才统计缺勤',
      button(prototypeState.eventClosed ? '重新开放（演示）' : '结束签到窗口', 'close-event', true)
    ) +
    `<div class="split">${panel('客服交接实操课（演示）', `<p>10 月 12 日 14:00–15:00；总部培训室</p><p>${badge(prototypeState.eventClosed ? '已结束' : '签到中', prototypeState.eventClosed ? '' : 'green')}　应到 24 人 / 已签到 ${signedCount} 人</p><div class="qr-placeholder"><strong>${prototypeState.eventClosed ? '二维码已失效' : '签到二维码'}</strong><p>动态码设计占位，不可扫码</p></div><p class="notice">本人登录后核验场次资格与有效时间；重复扫码不重复计数。</p>${link('learner-signin', '手机签到预览', 'button')}`)}
    ${panel('签到名单', `<div class="score-line"><span>已签到</span><strong>${signedCount} 人</strong></div><div class="score-line"><span>${prototypeState.eventClosed ? '缺勤' : '尚未签到'}</span><strong>${24 - signedCount} 人</strong></div><div class="score-line"><span>签到率</span><strong>${((signedCount / 24) * 100).toFixed(1)}%</strong></div><div class="actions" style="margin-top:18px">${button('模拟一名学员签到', 'simulate-signin', true, prototypeState.eventClosed ? 'disabled' : '')}${button('导出名单', 'domain-export', false, 'data-domain="签到"')}</div><p class="notice">经批准请假单列；未结束时不把未签到人员标成缺勤。</p>`)}</div>` +
    panel(
      '签到明细',
      `<div class="table-scroll"><table><thead><tr><th>员工</th><th>部门</th><th>签到状态</th><th>签到时间</th></tr></thead><tbody>${employees
        .slice(0, 8)
        .map(
          (employee) =>
            `<tr><td>${employee.name}</td><td>${employee.department}</td><td>${badge(employee.signedIn ? '已签到' : prototypeState.eventClosed ? '缺勤' : '未签到', employee.signedIn ? 'green' : prototypeState.eventClosed ? 'red' : '')}</td><td>${employee.signedIn ? '10-12 13:55（演示）' : '—'}</td></tr>`
        )
        .join('')}</tbody></table></div>`
    )
  );
}
function mentoringMarkup() {
  return (
    heading(
      '导师带教',
      '师徒绑定、下发任务、导师点评与认证形成独立记录',
      button('下发带教任务', 'mentor-task-create') + button('批量绑定师徒', 'mentor-bind', true)
    ) +
    panel(
      '新人带教清单',
      `<div class="table-scroll"><table><thead><tr><th>学员</th><th>部门</th><th>导师</th><th>课程学习</th><th>考试</th><th>导师认证</th><th>操作</th></tr></thead><tbody>${visibleEmployees()
        .slice(0, 8)
        .map(
          (employee) =>
            `<tr><td>${employee.name}</td><td>${employee.department}</td><td>${employee.mentor}</td><td>${employee.progress}%</td><td>${employee.score ?? '未参加'}</td><td>${badge(employee.certified ? '已认证' : '待认证', employee.certified ? 'green' : '')}</td><td>${link('mentor', '查看带教')}</td></tr>`
        )
        .join('')}</tbody></table></div>`
    ) +
    panel(
      '带教任务模板',
      '<div class="task-row"><div><strong>认识公司与岗位</strong><p>课程任务：按课程完成标准判定</p></div>' +
        badge('线上学习', 'blue') +
        '</div><div class="task-row"><div><strong>完成一次客服交接演练</strong><p>实操任务：学员提交证据，导师点评、评分与认证</p></div>' +
        badge('实操', 'orange') +
        '</div><p class="notice">逾期未完成由系统提醒学员；待点评提醒导师。更换导师保留原关系和历史点评。</p>'
    )
  );
}
function automationMarkup() {
  return (
    heading(
      '自动派课与督学',
      '一次设置规则，入职事件触发派课，异常进入待处理队列',
      button('创建派课规则', 'rule-create', true)
    ) +
    `<div class="split">${panel('新人派课规则（演示）', '<div class="score-line"><span>触发条件</span><strong>钉钉新增总部在职员工</strong></div><div class="score-line"><span>匹配条件</span><strong>客服一部 且 客服专员</strong></div><div class="score-line"><span>下发内容</span><strong>通用课程 + 岗位微课 + 实操</strong></div><div class="score-line"><span>重复入职事件</span><strong>按员工与规则去重</strong></div><div class="actions" style="margin-top:18px">' + button('模拟新人匹配', 'rule-preview', true) + '</div>')}
    ${panel('持续督学设置', '<ul class="policy-list"><li><input type="checkbox" checked id="remind-auto"><label for="remind-auto">未学 / 滞后自动提醒<small style="display:block">每天最多一次；离职或已完成自动停止</small></label></li><li><input type="checkbox" checked id="remind-manager"><label for="remind-manager">每周向主管发送本部门报告</label></li><li><input type="checkbox" checked id="remind-mentor"><label for="remind-mentor">提醒导师处理待点评任务</label></li></ul><p class="notice">站内创建、钉钉已发送、发送失败及学员已读分别展示。</p>')}</div>` +
    panel(
      '执行记录（演示）',
      '<div class="table-scroll"><table><thead><tr><th>事件</th><th>匹配结果</th><th>派课</th><th>通知</th><th>处理</th></tr></thead><tbody><tr><td>总部新人加入</td><td>客服一部 / 客服专员</td><td>' +
        badge('成功', 'green') +
        '</td><td>' +
        badge('待发送', 'orange') +
        '</td><td>等待消息作业</td></tr><tr><td>集团非总部人员加入</td><td>不在总部白名单</td><td>未派课</td><td>未发送</td><td>无需处理</td></tr><tr><td>总部新人缺岗位</td><td>资料不完整</td><td>待补资料</td><td>未发送</td><td>' +
        button('查看异常', 'rule-exception') +
        '</td></tr></tbody></table></div>'
    )
  );
}
function reportsMarkup() {
  return (
    heading('报表中心', '所有导出沿用当前权限、筛选条件与统计时点', button('导出学习名单', 'export', true)) +
    metricsMarkup(visibleEmployees()) +
    panel(
      '选择报表',
      ['学习进度与未学名单', '考试成绩与不合格名单', '问卷回收与评价', '线下签到与缺勤', '导师带教与认证']
        .map(
          (domain) =>
            `<div class="queue-row"><div><strong>${domain}</strong><p>包含筛选范围、统计时点、导出人和字段说明</p></div>${button('导出 CSV / Excel', 'domain-export', false, `data-domain="${domain}"`)}</div>`
        )
        .join('')
    ) +
    panel(
      '部门学习完成率',
      departments
        .filter((department) => role !== 'manager' || department === '客服一部')
        .map((department) => {
          const records = employees.filter((employee) => employee.department === department);
          const completed = records.filter((employee) => employee.progress === 100).length;
          return `<div class="bar-chart-row"><span>${department}</span><div class="bar-chart-track"><i style="width:${(completed / records.length) * 100}%"></i></div><strong>${completed}/${records.length}</strong></div>`;
        })
        .join('') + '<p class="notice">按学员人数去重；当前为同一个演示培训计划，不能把跨计划人次作为总部覆盖率。</p>'
    )
  );
}
function permissionsMarkup() {
  return (
    heading(
      '权限与操作记录',
      '动作权限与数据范围同时生效，主管按明确部门授权',
      button('查看授权方案', 'role-preview', true)
    ) +
    panel(
      '角色范围草案',
      '<div class="table-scroll"><table><thead><tr><th>角色</th><th>数据范围</th><th>主要动作</th></tr></thead><tbody><tr><td>培训岗</td><td>总部全部</td><td>建课、派课、考试、督学、导出</td></tr><tr><td>部门主管</td><td>明确授权的本部门</td><td>查看、督学、部门报表；建课/派课单独授权</td></tr><tr><td>导师</td><td>当前带教关系中的学员和任务</td><td>点评、评分、认证</td></tr><tr><td>员工</td><td>本人</td><td>学习、考试、签到、评价</td></tr><tr><td>老板</td><td>总部汇总，默认只读</td><td>查看大盘；个人明细需显式授权</td></tr></tbody></table></div><p class="notice">运营部 5 名平行主管按实际负责范围逐一授权，不按“总监”层级推导；钉钉管理员不自动获得培训管理权限。</p>'
    ) +
    panel(
      '操作记录（虚构示例）',
      '<div class="table-scroll"><table><thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>对象 / 范围</th><th>结果</th></tr></thead><tbody><tr><td>10-12 09:15</td><td>培训岗</td><td>批量催学</td><td>新人通用培训，5 人</td><td>' +
        badge('站内创建成功', 'green') +
        '</td></tr><tr><td>10-12 09:12</td><td>客服一部主管</td><td>访问跨部门名单</td><td>剪辑部</td><td>' +
        badge('拒绝', 'red') +
        '</td></tr><tr><td>10-11 17:30</td><td>赵师傅</td><td>实操认证</td><td>本人带教学员</td><td>' +
        badge('成功', 'green') +
        '</td></tr></tbody></table></div>'
    )
  );
}
function executiveMarkup() {
  const records = visibleEmployees();
  const started = records.filter((employee) => employee.progress > 0).length;
  return (
    heading(
      '总部学习大盘',
      '总部 621 人 / 19 部门（范围基准）；本页数据为 24 名虚构学员',
      button('全屏查看', 'fullscreen', true)
    ) +
    `<div class="alert">统计时点：2026-10-12；演示计划覆盖 24 / 24 人，已开始 ${started} / 24 人。正式总部覆盖率须使用当期总部在职名单作为分母。</div>` +
    metricsMarkup(records) +
    `<div class="split">${panel(
      '各部门完成情况',
      departments
        .map((department) => {
          const departmentEmployees = employees.filter((employee) => employee.department === department);
          const completed = departmentEmployees.filter((employee) => employee.progress === 100).length;
          return `<div class="bar-chart-row"><span>${department}</span><div class="bar-chart-track"><i style="width:${(completed / departmentEmployees.length) * 100}%"></i></div><strong>${completed}/${departmentEmployees.length}</strong></div>`;
        })
        .join('') + '<p class="notice">展示人数、分母和完成率，避免小样本部门的百分比造成误解。</p>'
    )}
    ${panel('需要关注的培训结果', '<div class="score-line"><span>尚未学习</span><strong>5 人</strong></div><div class="score-line"><span>考试不合格</span><strong>2 人</strong></div><div class="score-line"><span>待带教认证</span><strong>21 人</strong></div><p class="notice">大盘帮助定位培训跟进问题；新人离职率与培训效果分别统计，不自动推断因果。</p>')}</div>`
  );
}
function mentorMarkup() {
  const review = prototypeState.mentorReview;
  const comment = review?.comment ?? '素材命名清楚，自检项目完整。下次注意导出前再次核对画面和声音。';
  return (
    heading('我的带教', '赵师傅；仅查看本人带教学员', link('mentoring', '培训岗视角', 'button')) +
    panel(
      '待处理实操任务',
      `<div class="alert">陈诺 / 剪辑部；课程进度 95%，考试未参加。实操点评与课程、考试分别留痕。</div><h3>完成一次剪辑交付检查</h3><p>学员已提交素材命名检查与交付自检说明（演示）。</p><div class="form-grid"><label class="field">实操评分<input id="mentor-score" type="number" min="0" max="100" value="${review?.score ?? 85}"></label><label class="field">认证结果<select id="mentor-result"><option ${review?.result !== '退回补充' ? 'selected' : ''}>通过认证</option><option ${review?.result === '退回补充' ? 'selected' : ''}>退回补充</option></select></label></div><label class="field">点评与依据<textarea id="mentor-comment">${escapeHtml(comment)}</textarea></label>${review ? `<div class="alert" role="status">陈诺的点评已保存（演示）：${review.score} 分 / ${escapeHtml(review.result)}。<p style="margin:8px 0">${escapeHtml(review.comment)}</p>课程进度仍为 95%，考试仍为未参加；认证独立留痕。</div>` : ''}<div class="form-footer">${button('保存点评与认证', 'mentor-review', true)}</div>`
    ) +
    panel(
      '我带教的学员',
      learningTable(
        employees.filter((employee) => employee.mentor === '赵师傅'),
        true
      )
    )
  );
}
function mobileMarkup() {
  const learner = employees[1];
  const headers = `<div class="mobile-top"><strong>至臻培训</strong><div class="actions">${link('index', '设计地图')}${button('明暗', 'theme')}</div></div>`;
  let content = '';
  if (currentPage === 'learner-mentoring')
    content = `<small>${link('learner', '返回我的学习')}</small><h1 style="margin-top:14px">我的带教任务</h1><div class="panel"><h2>完成一次客服交接演练</h2><p>导师：李师傅 / 10 月 14 日前完成</p><p>完成要求：记录待处理事项、风险提示和双方确认，提交实操说明，由导师点评和认证。</p></div>${prototypeState.taskEvidence ? `<div class="alert" role="status">实操说明已提交（演示），等待李师傅点评。<p style="margin:8px 0">${escapeHtml(prototypeState.taskEvidence)}</p>导师认证仍为待认证；课程进度、考试分不因提交任务改变。</div>${link('learner-archive', '查看我的进度', 'button')}` : `<label class="field">实操说明<textarea id="task-evidence" placeholder="说明本次交接如何确认待办、风险和双方接收"></textarea></label><p class="notice">正式功能支持补充图片或文档证据，按本人任务归档；本稿只模拟文字提交。</p>${button('提交实操给导师', 'learner-task-submit', true)}`}<p class="notice">导师退回后允许补充再提交，保留每次版本和点评。</p>`;
  if (currentPage === 'learner')
    content = `<p class="muted">陈晴，今天继续完成这一步</p><h1>我的学习</h1><div class="next-task"><small>新人通用培训 / 10 月 14 日截止</small><h2>客服交接三件事</h2><p>03:40 微课；上次学到 01:24</p><div class="progress-track" style="width:100%"><i style="width:35%"></i></div>${link('learning', '继续学习', 'button primary')}</div><div class="mobile-metrics"><div><strong>35%</strong><small>课程进度</small></div><div><strong>未考</strong><small>考试结果</small></div><div><strong>待认证</strong><small>导师带教</small></div></div><h2>接下来要做</h2><div class="task-row"><div><strong>新人基础知识考试</strong><p>30 分钟 / 及格 60 分</p></div>${link('learner-exam', '参加考试', 'button')}</div><div class="task-row"><div><strong>客服交接实操课</strong><p>今天 14:00 / 总部培训室</p></div>${link('learner-signin', '签到', 'button')}</div><div class="task-row"><div><strong>我的带教任务</strong><p>李师傅 / 提交交接实操说明</p></div>${link('learner-mentoring', '提交实操', 'button')}</div><div class="task-row"><div><strong>课后评价</strong><p>提交满意度与建议</p></div>${link('learner-survey', '填写', 'button')}</div><p class="notice">学员端为手机版 H5；沿用现有钉钉账号对接。</p>`;
  if (currentPage === 'learning')
    content = `<small>${link('learner', '返回我的学习')}</small><h1 style="margin-top:14px">客服交接三件事</h1><div class="video-design"><div><strong>微课播放器设计示意</strong><small>03:40；无实际视频资源</small></div></div><div class="score-line"><span>断点位置</span><strong id="video-position">${Math.floor(prototypeState.playingSeconds / 60)}:${String(prototypeState.playingSeconds % 60).padStart(2, '0')}</strong></div><div class="score-line"><span>有效观看</span><strong>${prototypeState.playingSeconds} / 220 秒（演示）</strong></div><p class="notice">首次学习限制向前跳过未学内容；已学部分可复习。暂停、切后台和断网不增加有效时长。</p><div class="actions" style="margin:16px 0">${button('模拟有效观看 10 秒', 'simulate-watch', true)}${button('尝试拖到末尾', 'seek-end')}</div><label class="field">学习笔记<textarea placeholder="记录交接中容易遗漏的事项"></textarea></label><h2>完成后下一步</h2>${link('learner-exam', '参加知识考试', 'button')}`;
  if (currentPage === 'learner-exam')
    content = `<small>${link('learner', '返回我的学习')}</small><h1 style="margin-top:14px">新人基础知识考试</h1><div class="alert">剩余 29:40（示意）；离开页面记录事件，退出继续计时。提交后不可修改。</div>${
      prototypeState.examSubmitted
        ? `<div class="empty"><h2>${prototypeState.answer === 'B' ? '本题答对' : '本题答错'}</h2><p>仅演示单题判分与交卷状态；不会写入真实考试成绩。</p>${link('learner-archive', '查看进度', 'button primary')}</div>`
        : '<h2>1. 交接工作时应先确认什么？</h2>' +
          [
            ['A', '直接开始下一班工作'],
            ['B', '待处理事项、风险和双方确认'],
            ['C', '只确认当天销售额']
          ]
            .map(
              ([value, label]) =>
                `<label class="answer-option"><input type="radio" name="exam-answer" value="${value}" ${prototypeState.answer === value ? 'checked' : ''}><span>${value}. ${label}</span></label>`
            )
            .join('') +
          button('交卷', 'exam-submit', true) +
          `<p class="notice">当前是试卷交互示例。草稿保存、服务端截止和异常记录属于实施验收项。</p>`
    }`;
  if (currentPage === 'learner-signin')
    content = `<small>${link('learner', '返回我的学习')}</small><h1 style="margin-top:14px">线下培训签到</h1><div class="panel"><h2>客服交接实操课</h2><p>10 月 12 日 14:00–15:00</p><p>地点：总部培训室</p><div class="score-line"><span>签到人</span><strong>陈晴 / 客服二部</strong></div><div class="score-line"><span>签到资格</span><strong>已在本场应到名单</strong></div></div><div class="alert">${learner.signedIn ? '已签到（演示）；再次签到不重复记录。' : '签到窗口开放，确认后记录本人签到时间。'}</div>${button(learner.signedIn ? '再次确认签到' : '确认签到', 'learner-signin', true)}<p class="notice">用钉钉扫一扫或手机系统相机打开 H5 链接；登录后保留本场签到入口。</p>`;
  if (currentPage === 'learner-survey')
    content = `<small>${link('learner', '返回我的学习')}</small><h1 style="margin-top:14px">课后评价</h1><p class="muted">客服交接三件事 / 实名评价示例</p>${prototypeState.surveySubmitted ? '<div class="empty"><h2>评价已提交</h2><p>感谢反馈；本页演示不保存真实答卷。</p>' + link('learner', '返回学习首页', 'button primary') + '</div>' : '<h2>这门课对工作有帮助吗？</h2><div class="rating">' + [1, 2, 3, 4, 5].map((value) => `<label><input type="radio" name="rating" value="${value}" ${value === 4 ? 'checked' : ''}>${value} 分</label>`).join('') + '</div><label class="field">希望补充哪些内容？<textarea placeholder="例如：异常问题的交接案例"></textarea></label>' + button('提交评价', 'survey-submit', true)}`;
  if (currentPage === 'learner-archive')
    content = `<small>${link('learner', '返回我的学习')}</small><h1 style="margin-top:14px">我的进度</h1><div class="mobile-metrics"><div><strong>35%</strong><small>课程进度</small></div><div><strong>未参加</strong><small>考试</small></div><div><strong>待认证</strong><small>带教</small></div></div><h2>学习记录（演示）</h2><ul class="timeline"><li><strong>继续观看客服微课</strong><small>10-11 19:42；累计 84 秒</small></li><li><strong>阅读公司介绍</strong><small>10-10 09:30；未达到完成要求</small></li><li><strong>收到新人培训任务</strong><small>10-01 09:00；导师：李师傅</small></li></ul><div class="alert">学习完成、考试合格、导师认证分别展示。到达 100% 不直接代表考核合格。</div>`;
  if (prototypeState.scenario === 'empty')
    content =
      '<div class="empty"><h1>还没有学习任务</h1><p>任务下发后会出现在这里。课程库可以从空库开始逐步补充。</p>' +
      button('返回正常演示', 'normal', true) +
      '</div>';
  if (prototypeState.scenario === 'error')
    content =
      '<div class="empty" role="alert"><h1>任务暂时无法加载</h1><p>无法确认最新进度，请稍后重试。</p>' +
      button('重试加载', 'normal', true) +
      '</div>';
  if (prototypeState.scenario === 'denied')
    content =
      '<div class="empty"><h1>暂无此任务的访问资格</h1><p>请返回本人任务；如已被分配，联系培训岗核对。</p>' +
      button('返回本人任务', 'normal', true) +
      '</div>';
  const nav = [
    ['learner', '学习', 'book'],
    ['learner-exam', '考试', 'list'],
    ['learner-signin', '签到', 'check'],
    ['learner-archive', '我的', 'people']
  ];
  return `<div class="mobile-stage">${headers}<div class="mobile-body">${content}</div><nav class="mobile-tabs" aria-label="学员导航">${nav.map(([page, label, iconName]) => link(page, icon(iconName) + label, currentPage === page ? 'active' : '')).join('')}</nav></div>`;
}
function reviewMapMarkup() {
  const groups = [
    [
      '培训岗 PC',
      [
        ['workbench', '培训工作台', '优先处理未学、考试不合格与待点评'],
        ['tracking', '学习追踪', '筛选、批量催学、导出和个人证据'],
        ['people', '组织与员工', '总部白名单、员工导入、岗位工种'],
        ['courses', '课程管理', '素材上传、微课、空库启动'],
        ['plan', '培训计划', '课程、人员、导师与发布核对'],
        ['exam', '考试管理', '组卷、判分、补考与基础防作弊'],
        ['survey', '问卷与评价', '定向调研、课后评价与回收'],
        ['attendance', '线下签到', '应到名单、扫码入口与缺勤'],
        ['mentoring', '导师带教', '师徒绑定、任务与认证'],
        ['automation', '自动派课与督学', '入职匹配、持续提醒与主管报告'],
        ['reports', '报表中心', '学习、考试、问卷、签到、带教'],
        ['permissions', '权限与记录', '动作权限、部门范围与操作留痕']
      ]
    ],
    [
      '主管、老板与导师',
      [
        ['tracking?role=manager', '主管本部门', '限制为客服一部，查看、督学与导出'],
        ['executive', '老板学习大盘', '覆盖、完成、考试与部门对比'],
        ['mentor', '导师工作台', '本人带教学员与实操点评认证']
      ]
    ],
    [
      '学员手机版 H5',
      [
        ['learner', '我的学习', '下一步任务与独立的进度/考核/认证'],
        ['learning', '课程学习', '有效时长、续学与限制前拖'],
        ['learner-exam', '在线考试', '规则提示、答题、交卷'],
        ['learner-signin', '扫码签到', '本人资格、重复签到状态'],
        ['learner-survey', '课后评价', '评分、文本反馈与已提交状态'],
        ['learner-archive', '我的进度', '学习行为、考试与带教记录'],
        ['learner-mentoring', '带教任务', '本人实操提交与导师点评状态']
      ]
    ]
  ];
  return `<main class="review-map"><div class="map-intro"><div class="brand"><span class="brand-mark">Z</span><strong>至臻培训</strong></div><h1>一期需求与界面设计稿</h1><p>围绕“谁学了、谁没学、进度、考试情况”，把培训岗、主管、老板、导师和学员的操作串起来。</p><p>学员端已按最新决定改为手机版 H5；钉钉与现有人事系统沿用现有对接。</p></div><div class="map-journey"><strong>建议先看这条操作路径</strong><p style="margin:8px 0 14px">${link('tracking', '筛选未学人员')} → 批量催学 → ${link('plan', '发布培训计划')} → ${link('learner', '员工继续学习')} → ${link('learner-exam', '参加考试')} → ${link('mentor', '导师点评')} → ${link('executive', '查看总部大盘')}</p><small>全部数据为虚构演示，24 人 / 5 部门 / 1 个计划。621 人 / 19 部门仅为需求范围，页面不会连接真实服务或发送消息。</small></div>${groups.map(([title, pages]) => `<h2>${title}</h2><div class="map-grid">${pages.map(([page, title, note]) => `<a class="map-link" href="${page.includes('?') ? page.replace('?', '.html?') : page + '.html'}"><strong>${title}</strong><p>${note}</p></a>`).join('')}</div>`).join('')}<section class="panel"><h2>本次评审边界</h2><p>界面与流程已形成设计稿。基础能力复用现有代码，问卷、二维码签到、带教和自动派课需实施补齐。当前电脑 Docker 部署仍等待 Windows 重启，设计稿不代表业务已上线。</p><div class="actions"><a class="button" href="requirements.md" download="至臻培训一期需求对照与方案.md">下载一期方案</a>${button('切换明暗', 'theme')}</div></section></main>`;
}
function prototypeBar() {
  return `<div class="prototype-bar"><span>界面设计稿 · 虚构数据 · 2026-10-12</span><div class="actions">${link('index', '返回设计地图')}<label>演示状态 <select id="scenario" aria-label="演示状态"><option value="normal">正常</option><option value="empty">空数据 / 空库</option><option value="error">请求失败</option><option value="denied">权限不足</option></select></label></div></div>`;
}
function navigationMarkup() {
  const groups =
    currentPage === 'executive'
      ? [['总部视角', [['executive', '学习大盘', 'chart']]]]
      : currentPage === 'mentor'
        ? [['本人带教', [['mentor', '我的带教', 'people']]]]
        : role === 'manager'
          ? [
              [
                '本部门',
                [
                  ['workbench', '部门工作台', 'grid'],
                  ['tracking', '学习追踪', 'chart'],
                  ['reports', '部门报表', 'list']
                ]
              ]
            ]
          : [
              [
                '日常跟进',
                [
                  ['workbench', '培训工作台', 'grid'],
                  ['tracking', '学习追踪', 'chart'],
                  ['reports', '报表中心', 'list']
                ]
              ],
              [
                '培训组织',
                [
                  ['courses', '课程管理', 'book'],
                  ['plan', '培训计划', 'list'],
                  ['exam', '考试管理', 'check'],
                  ['survey', '问卷与评价', 'list'],
                  ['attendance', '线下签到', 'clock'],
                  ['mentoring', '导师带教', 'people']
                ]
              ],
              [
                '组织与设置',
                [
                  ['people', '组织与员工', 'people'],
                  ['automation', '自动派课与督学', 'clock'],
                  ['permissions', '权限与记录', 'settings']
                ]
              ]
            ];
  return `<aside class="sidebar"><a href="index.html" class="brand"><span class="brand-mark">Z</span><div><strong>至臻培训</strong><small>总部内部学习平台</small></div></a><nav>${groups.map(([title, pages]) => `<span class="nav-group">${title}</span>${pages.map(([page, label, iconName]) => link(page, icon(iconName) + label, currentPage === page ? 'active' : '')).join('')}`).join('')}</nav><div class="sidebar-note">${role === 'manager' ? '当前范围：客服一部' : '需求范围：总部 621 人 / 19 部门'}<br>本页为交互设计示例</div></aside>`;
}
function render() {
  document.body.classList.toggle('executive', currentPage === 'executive');
  let markup = '';
  if (currentPage === 'index') markup = reviewMapMarkup();
  else if (currentPage.startsWith('learner') || currentPage === 'learning') markup = mobileMarkup();
  else {
    const renderers = {
      workbench: workbenchMarkup,
      tracking: trackingMarkup,
      people: peopleMarkup,
      courses: coursesMarkup,
      plan: planMarkup,
      exam: examMarkup,
      survey: surveyMarkup,
      attendance: attendanceMarkup,
      mentoring: mentoringMarkup,
      automation: automationMarkup,
      reports: reportsMarkup,
      permissions: permissionsMarkup,
      executive: executiveMarkup,
      mentor: mentorMarkup
    };
    const renderer = renderers[currentPage] || workbenchMarkup;
    let content = renderer();
    if (prototypeState.scenario === 'empty')
      content =
        heading(pageNames[currentPage] || '培训工作台', '当前范围尚无数据') +
        `<section class="panel empty"><h2>${currentPage === 'courses' ? '从第一份课程资料开始' : '当前范围暂无记录'}</h2><p>${currentPage === 'courses' ? '先上传视频或文档，保存草稿。课程准备好后再派给员工，平台可以空库启动。' : '尚未产生记录时，不显示虚构的完成率或考试分。请调整筛选，或先创建并发布培训任务。'}</p>${button('返回正常演示', 'normal', true)}</section>`;
    if (prototypeState.scenario === 'error')
      content =
        heading(pageNames[currentPage] || '培训工作台', '记录暂时无法读取') +
        '<div class="panel empty" role="alert"><h2>学习数据加载失败</h2><p>暂时无法确认统计结果；已选人员不执行批量操作。</p>' +
        button('重试加载', 'normal', true) +
        '</div>';
    if (prototypeState.scenario === 'denied')
      content =
        heading('无权查看此范围', '请返回已授权的部门或本人数据') +
        '<div class="panel empty"><h2>当前账号没有该数据范围的权限</h2><p>修改页面地址不改变权限；如确需处理，联系培训岗核对授权。</p>' +
        button('返回已授权范围', 'normal', true) +
        '</div>';
    markup = `<div class="shell">${navigationMarkup()}<div class="workspace"><header class="topbar"><div class="actions"><button class="menu-toggle" data-action="menu">菜单</button><span>${role === 'manager' ? '客服一部 / 部门主管' : currentPage === 'mentor' ? '导师工作台 / 赵师傅' : currentPage === 'executive' ? '总部汇总 / 老板只读' : '总部 / 培训岗'}</span></div><div class="topbar-actions">${currentPage === 'executive' ? '' : link('learner', '切换学习端')}${button('明暗', 'theme')}<span class="avatar">${role === 'manager' ? '主' : currentPage === 'mentor' ? '师' : currentPage === 'executive' ? '总' : '培'}</span><span class="user-label">${role === 'manager' ? '部门主管' : currentPage === 'mentor' ? '赵师傅' : currentPage === 'executive' ? '老板只读' : '培训管理'}</span></div></header><main>${content}</main></div></div>`;
  }
  document.getElementById('app').innerHTML = prototypeBar() + markup;
  document.getElementById('scenario').value = prototypeState.scenario;
}
function toast(message) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = 'toast';
  element.role = 'status';
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 4200);
}
function modal(title, body, confirmLabel = '', onConfirm = null) {
  const dialog = document.getElementById('prototype-dialog');
  dialog.innerHTML = `<button class="dialog-close" aria-label="关闭对话框">×</button><h2>${title}</h2>${body}<div class="form-footer"><button data-close>关闭</button>${confirmLabel ? `<button class="primary" data-confirm>${confirmLabel}</button>` : ''}</div>`;
  dialog.querySelector('.dialog-close').onclick = () => dialog.close();
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  if (confirmLabel)
    dialog.querySelector('[data-confirm]').onclick = () => {
      dialog.close();
      onConfirm?.();
    };
  dialog.oncancel = (event) => event.preventDefault();
  dialog.showModal();
}
function reminderDialog(records) {
  const eligible = records.filter((employee) => employee.progress < 100 && !employee.reminded);
  modal(
    '确认催学范围',
    `<p>当前范围 ${records.length} 人，未完成且可提醒 ${eligible.length} 人。</p><p>已完成、重复提醒及当前范围外人员将被跳过。</p><label class="field">提醒渠道<select><option>站内 + 钉钉工作通知</option><option>仅站内</option></select></label><p class="notice">本设计稿只模拟结果，不发送真实消息。</p>`,
    '模拟创建提醒',
    () => {
      eligible.forEach((employee) => {
        employee.reminded = true;
      });
      prototypeState.selectedIds.clear();
      render();
      toast(`已模拟创建 ${eligible.length} 条站内提醒；钉钉为待发送示意`);
    }
  );
}
function exportCsv() {
  const records = currentPage === 'tracking' ? filteredEmployees() : visibleEmployees();
  const rows = [
    ['说明', '虚构演示数据，不含真实人员'],
    ['员工', '工号', '部门', '岗位', '工种', '进度%', '最近学习', '考试分', '考核结果', '导师认证'],
    ...records.map((employee) => [
      employee.name,
      employee.id,
      employee.department,
      employee.position,
      employee.jobType,
      employee.progress,
      employee.lastLearning,
      employee.score ?? '',
      employee.score === null ? '未参加' : employee.score >= 60 ? '合格' : '不合格',
      employee.certified ? '已认证' : '待认证'
    ])
  ];
  const csv =
    '\uFEFF' +
    rows.map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = '设计稿-虚构学员筛选名单.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  toast(`已导出 ${records.length} 名虚构学员的筛选结果`);
}
document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.id === 'scenario') {
    prototypeState.scenario = target.value;
    prototypeState.selectedIds.clear();
    render();
  }
  if (target.dataset.field) {
    prototypeState[target.dataset.field] = target.value;
    prototypeState.selectedIds.clear();
    render();
  }
  if (target.dataset.employee) {
    target.checked
      ? prototypeState.selectedIds.add(target.dataset.employee)
      : prototypeState.selectedIds.delete(target.dataset.employee);
    render();
  }
  if (target.name === 'exam-answer') prototypeState.answer = target.value;
});
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action], [data-status]');
  if (!target) return;
  if (target.tagName === 'A') event.preventDefault();
  if (target.dataset.status) {
    prototypeState.status = target.dataset.status;
    prototypeState.selectedIds.clear();
    render();
    return;
  }
  const action = target.dataset.action;
  if (action === 'theme') {
    document.body.classList.toggle('dark');
    return;
  }
  if (action === 'menu') {
    document.body.classList.toggle('menu-open');
    return;
  }
  if (action === 'normal') {
    prototypeState.scenario = 'normal';
    render();
    return;
  }
  if (action === 'select-all') {
    const records = filteredEmployees();
    target.checked
      ? records.forEach((employee) => prototypeState.selectedIds.add(employee.id))
      : prototypeState.selectedIds.clear();
    render();
    return;
  }
  if (action === 'export') {
    exportCsv();
    return;
  }
  if (action === 'remind-filtered') {
    reminderDialog(filteredEmployees());
    return;
  }
  if (action === 'remind-selected') {
    reminderDialog(filteredEmployees().filter((employee) => prototypeState.selectedIds.has(employee.id)));
    return;
  }
  if (action === 'employee-detail') {
    const employee = employees.find((person) => person.id === target.dataset.id);
    if (!employee) return;
    modal(
      employee.name + '的学习记录',
      `<p>${employee.department} / ${employee.position} / ${employee.id}</p><div class="score-line"><span>课程进度</span><strong>${employee.progress}%</strong></div><div class="score-line"><span>考试结果</span><strong>${employee.score === null ? '未参加' : employee.score + '分 / ' + (employee.score >= 60 ? '合格' : '不合格')}</strong></div><div class="score-line"><span>导师认证</span><strong>${employee.certified ? '已认证' : '待认证'}</strong></div><p class="notice">按课时查看有效观看、有效阅读、最近活动和完成证据；这里仅展示虚构摘要。</p>`
    );
    return;
  }
  if (action === 'plan-next' || action === 'plan-back') {
    prototypeState.planStep += action === 'plan-next' ? 1 : -1;
    render();
    return;
  }
  if (action === 'plan-publish') {
    modal(
      '发布培训计划',
      '<p>将向 5 名演示人员指派 1 门课程、1 场考试和 1 项带教任务。</p><p>未发布内容、越权人员和缺少导师会显示明确处理结果。</p>',
      '模拟发布',
      () => toast('计划发布流程已演示；未创建真实任务')
    );
    return;
  }
  if (action === 'empty-library') {
    prototypeState.scenario = 'empty';
    render();
    return;
  }
  if (action === 'close-event') {
    prototypeState.eventClosed = !prototypeState.eventClosed;
    render();
    return;
  }
  if (action === 'simulate-signin') {
    const employee = employees.find((person) => !person.signedIn);
    if (employee) employee.signedIn = true;
    render();
    toast('已模拟本人签到，名单与签到率同步更新');
    return;
  }
  if (action === 'learner-signin') {
    const wasSignedIn = employees[1].signedIn;
    employees[1].signedIn = true;
    render();
    toast(wasSignedIn ? '已签到，重复确认不新增记录' : '已模拟签到成功');
    return;
  }
  if (action === 'simulate-watch') {
    prototypeState.playingSeconds = Math.min(220, prototypeState.playingSeconds + 10);
    render();
    toast('仅模拟有效观看增加 10 秒');
    return;
  }
  if (action === 'seek-end') {
    toast('首次学习不能跳过未学内容；当前位置未改变');
    return;
  }
  if (action === 'exam-submit') {
    if (!prototypeState.answer) {
      toast('请先选择答案');
      return;
    }
    modal('确认交卷', '<p>已回答 1 道演示题。提交后不能修改。</p>', '确认交卷', () => {
      prototypeState.examSubmitted = true;
      render();
    });
    return;
  }
  if (action === 'survey-submit') {
    prototypeState.surveySubmitted = true;
    render();
    return;
  }
  if (action === 'learner-task-submit') {
    const evidence = document.getElementById('task-evidence').value.trim();
    if (!evidence) {
      toast('请先填写实操说明');
      return;
    }
    prototypeState.taskEvidence = evidence;
    render();
    return;
  }
  if (action === 'mentor-review') {
    const scoreInput = document.getElementById('mentor-score');
    const score = Number(scoreInput.value);
    const result = document.getElementById('mentor-result').value;
    const comment = document.getElementById('mentor-comment').value.trim();
    if (scoreInput.value === '' || !Number.isFinite(score) || score < 0 || score > 100) {
      toast('评分需为 0–100 分');
      return;
    }
    if (!comment) {
      toast('请填写点评与依据');
      return;
    }
    prototypeState.mentorReview = { score, result, comment };
    employees[12].certified = result === '通过认证';
    render();
    toast('已模拟保存点评与认证，学习进度和考试成绩未改变');
    return;
  }
  if (action === 'fullscreen') {
    document.documentElement.requestFullscreen?.().catch(() => toast('请使用浏览器全屏功能'));
    return;
  }
  const dialogs = {
    'import-preview': [
      '员工导入预览',
      '<p>总部员工文件先校验工号、部门、岗位、工种与钉钉身份。按行显示新增、已存在、资料不完整和冲突。</p><p>演示：24 行，21 行可导入，3 行待补资料。只确认有效行；不会按姓名自动合并账号。</p>',
      '模拟确认有效行'
    ],
    'directory-preview': [
      '钉钉同步预览',
      '<p>先选择总部部门白名单，再读取获授权目录。多部门员工指定主部门；非总部人员不自动导入。</p><p>集团通讯录数量不作为总部培训人数。</p>',
      '模拟确认映射'
    ],
    'group-preview': [
      '批量设置工种与班次',
      '<label class="field">工种<select><option>客服</option><option>剪辑</option><option>主播</option><option>货架电商</option></select></label><label class="field">班次<select><option>早班</option><option>晚班</option></select></label>',
      '模拟保存'
    ],
    'create-course': [
      '新建内部课程',
      '<label class="field">课程名称<input placeholder="例如：客服交接三件事"></label><label class="field">资源形式<select><option>3–5 分钟微课</option><option>视频课程</option><option>文档课程</option></select></label><p>空库时先保存草稿，再逐步上传资料。</p>',
      '模拟保存草稿'
    ],
    'upload-preview': [
      '批量上传素材',
      '<p>选择多份视频或文档后，逐项显示上传、转码、可预览与失败原因。未完成资源不会进入发布内容。</p>',
      '模拟上传流程'
    ],
    'course-policy': [
      '课程学习要求',
      '<p>文档需完成有效阅读与逐页要求；视频按实际观看累计，首次学习限制前拖。完成要求由课程版本固定，不能只把打开页面视为学完。</p>',
      ''
    ],
    'exam-create': [
      '新建考试',
      '<label class="field">考试名称<input value="新人基础知识考试"></label><label class="field">组卷方式<select><option>题库选题</option><option>逐题编辑</option><option>复用已发布试卷</option></select></label><p>题目、分值、考试窗口、及格线和防作弊规则在发布前核对。</p>',
      '模拟创建草稿'
    ],
    'paper-edit': [
      '试卷设计',
      '<p>单选 10 题、多选 5 题、判断 5 题（示例），共 100 分。题目版本固定；客观题由服务端判分，主观题未评分时保留“待评分”。</p>',
      '模拟保存试卷'
    ],
    makeup: [
      '批量安排补考',
      '<p>选择不合格或缺考人员，设置补考窗口、机会次数与原因。正在考试人员单独提示，不覆盖历史答卷。</p>',
      '模拟安排补考'
    ],
    'survey-create': [
      '创建定向问卷',
      '<label class="field">类型<select><option>培训需求调研</option><option>课后评价</option></select></label><label class="field">回收方式<select><option>实名</option><option>匿名答案，独立参与记录</option></select></label>',
      '模拟保存问卷'
    ],
    'survey-preview': [
      '问卷预览',
      '<p>1. 目前最需要补充哪项技能？</p><p>2. 更适合早班前、晚班后还是碎片时间学习？</p><p>3. 有哪些具体困难？</p>',
      ''
    ],
    'survey-target': [
      '发布问卷与选人',
      '<p>选择部门或具体人员，预览受邀名单，设置截止时间。课后评价关联培训场次，二维码仅提供入口，仍校验身份与资格。</p>',
      '模拟发布'
    ],
    'mentor-bind': [
      '批量绑定师徒',
      '<p>按新人主部门匹配导师候选，显示每名学员及导师。未找到候选或已有关系冲突时留待处理，不自动覆盖。</p><p>讲师从组长、主管池选；导师资格按带教制度单独维护。</p>',
      '模拟确认绑定'
    ],
    'mentor-task-create': [
      '下发带教任务',
      '<label class="field">任务名称<input value="完成一次客服交接演练"></label><label class="field">下发对象<select><option>已绑定导师的客服新人</option><option>指定学员</option></select></label><label class="field">完成日期<input type="date" value="2026-10-14"></label><p>发布前核对师徒关系和完成标准；缺导师的人员进入待处理队列。</p>',
      '模拟确认下发'
    ],
    'rule-create': [
      '创建新人派课规则',
      '<p>触发：新增总部在职人员。匹配：部门与岗位条件采用“且”；不同规则可以明确设定“或”。</p><p>发布前展示样本匹配名单；重复事件不重复派课。</p>',
      '模拟保存规则'
    ],
    'rule-preview': [
      '新人匹配预览',
      '<p>新人 A：客服一部 + 客服专员，匹配岗位微课。</p><p>新人 B：集团其他公司，未进入总部范围，不派课。</p><p>新人 C：总部员工但缺岗位，进入待补资料队列。</p>',
      '模拟处理事件'
    ],
    'rule-exception': [
      '资料待补齐',
      '<p>员工属于总部，但缺少岗位。补齐岗位后重试匹配；保留原事件和处理结果。</p>',
      '模拟重试'
    ],
    'role-preview': [
      '角色授权范围',
      '<p>先选择动作，再指定数据范围。主管可以管理多个明确授权部门；同层主管互不获得对方范围。</p><p>讲师只处理获授权课程，导师只处理当前带教任务，老板默认查看总部汇总。</p>',
      ''
    ]
  };
  if (action === 'domain-export') {
    modal(
      '导出' + escapeHtml(target.dataset.domain) + '数据',
      '<p>导出 CSV 或 Excel，保留当前筛选、权限范围与统计时点。设计稿仅学习名单提供真实的虚构 CSV 下载，其他模块展示导出流程。</p>',
      '模拟生成报表',
      () => toast('报表生成流程已演示；未导出真实业务数据')
    );
    return;
  }
  if (dialogs[action]) {
    const [title, body, confirm] = dialogs[action];
    modal(title, body, confirm, () => toast('操作流程已演示；未连接真实服务'));
  }
});
render();
