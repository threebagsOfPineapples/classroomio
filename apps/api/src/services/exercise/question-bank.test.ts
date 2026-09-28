import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

it.skipIf(!process.env.QUESTION_BANK_TEST_DATABASE_URL)(
  'isolates the bank by organization, editing access and active membership',
  async () => {
    process.env.DATABASE_URL = process.env.QUESTION_BANK_TEST_DATABASE_URL;
    const { db, eq } = await import('@cio/db/drizzle');
    const schema = await import('@cio/db/schema');
    const { getCourseQuestionBank } = await import('@cio/db/queries/exercise');
    const rollback = new Error('rollback question bank test');
    const adminId = randomUUID();
    const tutorId = randomUUID();
    const studentId = randomUUID();
    const organizationId = randomUUID();
    const foreignOrgId = randomUUID();
    const groupIds = [randomUUID(), randomUUID(), randomUUID()];
    const courseIds = [randomUUID(), randomUUID(), randomUUID()];
    const exerciseIds = [randomUUID(), randomUUID(), randomUUID()];

    try {
      await db.transaction(async (transaction) => {
        const userIds = [adminId, tutorId, studentId];
        const users = userIds.map((id) => ({ id, name: 'Bank test', email: `${id}@example.test` }));
        const profiles = userIds.map((id) => ({ id, fullname: 'Bank test', username: id }));
        await transaction.insert(schema.user).values(users);
        await transaction.insert(schema.profile).values(profiles);
        await transaction.insert(schema.organization).values([
          { id: organizationId, name: 'Bank test' },
          { id: foreignOrgId, name: 'Foreign bank test' }
        ]);
        await transaction.insert(schema.organizationmember).values([
          { organizationId, profileId: adminId, roleId: 1 },
          { organizationId, profileId: tutorId, roleId: 2 },
          { organizationId, profileId: studentId, roleId: 3 },
          { organizationId: foreignOrgId, profileId: adminId, roleId: 1 }
        ]);
        const groups = groupIds.map((id, index) => ({
          id,
          name: 'Bank test',
          organizationId: index === 2 ? foreignOrgId : organizationId
        }));
        const courses = courseIds.map((id, index) => ({
          id,
          title: 'Bank test',
          description: '',
          groupId: groupIds[index]
        }));
        const exercises = exerciseIds.map((id, index) => ({
          id,
          title: 'Bank test',
          order: 0,
          courseId: courseIds[index]
        }));
        const questions = exerciseIds.map((exerciseId, index) => ({
          exerciseId,
          title: `Question ${index}`,
          questionTypeId: 1
        }));
        await transaction.insert(schema.group).values(groups);
        await transaction.insert(schema.course).values(courses);
        await transaction.insert(schema.exercise).values(exercises);
        await transaction.insert(schema.question).values(questions);
        await transaction.insert(schema.groupmember).values([
          { groupId: groupIds[0], profileId: tutorId, roleId: 2 },
          { groupId: groupIds[0], profileId: studentId, roleId: 3 }
        ]);

        const adminBank = await getCourseQuestionBank(courseIds[0], adminId, '', 1, transaction);
        const tutorBank = await getCourseQuestionBank(courseIds[0], tutorId, '', 1, transaction);
        const studentBank = await getCourseQuestionBank(courseIds[0], studentId, '', 1, transaction);
        const searchBank = await getCourseQuestionBank(courseIds[0], adminId, 'Question 1', 1, transaction);
        expect(adminBank.map((question) => question.title).sort()).toEqual(['Question 0', 'Question 1']);
        expect(tutorBank.map((question) => question.title)).toEqual(['Question 0']);
        expect(studentBank).toEqual([]);
        expect(searchBank.map((question) => question.title)).toEqual(['Question 1']);
        await transaction
          .update(schema.organizationmember)
          .set({ status: 'DEACTIVATED' })
          .where(eq(schema.organizationmember.organizationId, organizationId));
        expect(await getCourseQuestionBank(courseIds[0], adminId, '', 1, transaction)).toEqual([]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  },
  15000
);
