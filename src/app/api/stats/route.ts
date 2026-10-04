import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const { searchParams } = new URL(request.url);
    const schoolId = auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      totalCourses,
      totalPayments,
      paidPayments,
      pendingPayments,
    ] = await Promise.all([
      db.user.count({ where: { schoolId, role: 'STUDENT' } }),
      db.user.count({ where: { schoolId, role: 'TEACHER' } }),
      db.user.count({ where: { schoolId, role: 'PARENT' } }),
      db.schoolClass.count({ where: { schoolId } }),
      db.course.count({ where: { schoolId } }),
      db.payment.findMany({ where: { schoolId } }),
      db.payment.aggregate({
        where: { schoolId, status: 'paid' },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: { schoolId, status: 'pending' },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = paidPayments._sum.amount || 0;
    const pendingRevenue = pendingPayments._sum.amount || 0;

    const attendanceToday = new Date().toISOString().split('T')[0];
    const [
      presentToday,
      absentToday,
      totalAttendanceToday,
    ] = await Promise.all([
      db.attendance.count({
        where: { schoolId, date: attendanceToday, status: 'present' },
      }),
      db.attendance.count({
        where: { schoolId, date: attendanceToday, status: 'absent' },
      }),
      db.attendance.count({
        where: { schoolId, date: attendanceToday },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalStudents,
        totalTeachers,
        totalParents,
        totalClasses,
        totalCourses,
        totalPayments: totalPayments.length,
        totalRevenue,
        pendingRevenue,
        attendanceToday: {
          present: presentToday,
          absent: absentToday,
          total: totalAttendanceToday,
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
