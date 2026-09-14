import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { CalendarDriverDto } from "../../types";

export class DriverDirectoryError extends Error {
  constructor(
    message: string,
    public statusCode = 500
  ) {
    super(message);
    this.name = "DriverDirectoryError";
  }
}

export function toDriverDtos(users: User[]): CalendarDriverDto[] {
  return users
    .filter((user) => user.app_metadata.role === "driver" && Boolean(user.email))
    .map((user) => ({ id: user.id, email: user.email as string }))
    .sort((a, b) => a.email.localeCompare(b.email, "pl"));
}

export class DriverDirectoryService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async listDrivers(): Promise<CalendarDriverDto[]> {
    const perPage = 200;
    const users: User[] = [];

    for (let page = 1; ; page += 1) {
      const { data, error } = await this.supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw new DriverDirectoryError(`Failed to list drivers: ${error.message}`);
      users.push(...data.users);
      if (data.users.length < perPage) break;
    }

    return toDriverDtos(users);
  }
}
