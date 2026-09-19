import { apiHandler } from "@/lib/api/handler";

export const GET = apiHandler({ auth: "optional" }, async ({ user }) => {
  if (!user) return { user: null };
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      avatarUrl: user.avatarUrl,
      permissions: user.permissions,
      student: user.student,
      trainer: user.trainer,
      staff: user.staff,
    },
  };
});
