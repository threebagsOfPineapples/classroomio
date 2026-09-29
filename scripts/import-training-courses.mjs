import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const library = JSON.parse(
  await readFile(new URL('../docs/enterprise-training/courses/course-library.json', import.meta.url), 'utf8')
);
for (const course of library) {
  assert(course.title && course.description && course.lessons.length === 4);
  assert(course.questions.length === 5);
  for (const lesson of course.lessons)
    assert(lesson.note.length > 300 && /练习|任务|实操/.test(lesson.note), lesson.title);
  for (const question of course.questions) {
    assert(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length);
    assert(new Set(question.options).size === question.options.length && question.explanation);
  }
}

console.log(`课程包检查通过：${library.length} 门课程、12 个课时、15 道测验题。`);
if (!process.argv.includes('--apply')) process.exit(0);

const email = process.env.TRAINING_ADMIN_EMAIL;
const password = process.env.TRAINING_ADMIN_PASSWORD;
const organizationId = process.env.TRAINING_ORG_ID;
assert(email && password && organizationId, '请设置管理员账号、密码和组织 ID 环境变量。');
const base = 'http://localhost:3002';
const login = await fetch(`${base}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:4173' },
  body: JSON.stringify({ email, password })
});
assert(login.ok, `登录失败：${login.status}`);
const cookie = login.headers
  .getSetCookie()
  .map((value) => value.split(';')[0])
  .join('; ');
assert(cookie, '登录未返回会话。');

async function request(path, method = 'GET', payload) {
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const response = await fetch(base + path, {
    method,
    headers: {
      cookie,
      'cio-org-id': organizationId,
      'content-type': 'application/json',
      origin: 'http://localhost:4173'
    },
    body
  });
  const result = await response.json();
  assert(
    response.ok && result.success !== false,
    `${method} ${path}: ${response.status} ${result.error ?? JSON.stringify(result)}`
  );
  return result.data ?? result;
}

const receiptPath = join(tmpdir(), 'enterprise-training-course-import.json');
const receipt = await readFile(receiptPath, 'utf8')
  .then(JSON.parse)
  .catch((error) => {
    if (error.code !== 'ENOENT') throw error;

    return {};
  });
const save = () => writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');

for (const entry of library) {
  const receiptKey = `${organizationId}:${entry.slug}`;
  let record = receipt[receiptKey];
  if (!record) {
    const existing = await request(`/organization/courses?search=${encodeURIComponent(entry.title)}&limit=100`);
    assert(!existing.some((course) => course.title === entry.title), `已存在同名课程，停止以避免覆盖：${entry.title}`);
    const created = await request('/course', 'POST', {
      title: entry.title,
      description: entry.description,
      type: 'SELF_PACED',
      organizationId
    });
    record = { id: created.course.id, title: entry.title, lessons: {}, exercises: {}, complete: false };
    receipt[receiptKey] = record;
    await save();
  }
  const course = await request(`/course/${record.id}`);
  assert(!course.isPublished, `课程已发布，停止导入：${entry.title}`);
  if (record.complete) {
    console.log(`已完成，跳过：${entry.title}`);
    continue;
  }

  await request(`/course/${record.id}`, 'PUT', { slug: entry.slug });
  const existingLessons = await request(`/course/${record.id}/lesson?courseId=${record.id}`);
  for (const [index, lesson] of entry.lessons.entries()) {
    let lessonId = record.lessons[lesson.title];
    if (!lessonId) {
      const existing = existingLessons.find((item) => item.title === lesson.title);
      const created =
        existing ??
        (await request(`/course/${record.id}/lesson`, 'POST', {
          courseId: record.id,
          title: lesson.title,
          order: index + 1,
          isUnlocked: true
        }));
      lessonId = created.id;
      record.lessons[lesson.title] = lessonId;
      await save();
    }
    const detail = await request(`/course/${record.id}/lesson/${lessonId}`);
    const chinese = detail.lessonLanguages?.find((language) => language.locale === 'zh');
    if (!chinese) {
      await request(`/course/${record.id}/lesson/${lessonId}/language`, 'POST', {
        locale: 'zh',
        content: lesson.note,
        versionIntent: 'manual',
        versionLabel: '入门课程初稿'
      });
    }
  }

  const exerciseTitle = `${entry.title} · 课后测验`;
  if (!record.exercises[exerciseTitle]) {
    const existingExercises = await request(`/course/${record.id}/exercise`);
    const questions = entry.questions.map((question, index) => {
      const options = question.options.map((label, optionIndex) => ({
        label,
        isCorrect: optionIndex === question.answer
      }));
      return { question: question.question, questionTypeId: 1, points: 20, order: index, options };
    });
    const existing = existingExercises.find((exercise) => exercise.title === exerciseTitle);
    const created =
      existing ??
      (await request(`/course/${record.id}/exercise`, 'POST', {
        title: exerciseTitle,
        description: '共5道单选题，每题20分，用于检查本课程学习情况。请先完成四个课时，答题后回顾课内案例。',
        courseId: record.id,
        order: 5,
        questions
      }));
    record.exercises[exerciseTitle] = created.id;
    await save();
  }
  const feeds = await request(`/course/${record.id}/newsfeed`);
  for (const feed of feeds.items ?? []) {
    if (feed.content?.includes('Welcome to this course')) {
      await request(`/course/${record.id}/newsfeed/${feed.id}`, 'PUT', {
        content:
          '欢迎学习本课程。建议先按顺序完成四个课时，整理场景练习，再参加课后测验。公司制度尚待确认的内容，请向负责人核实。'
      });
    }
  }
  record.complete = true;
  await save();
  console.log(`已保存草稿：${entry.title} /courses/${record.id}/lessons`);
}
