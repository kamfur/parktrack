import type { CheckInCommand, CheckOutCommand } from "../../types";

export function createCheckInCommand(now = new Date()): CheckInCommand {
  return {
    status: "in_progress",
    actual_check_in: now.toISOString(),
  };
}

export function createCheckOutCommand(now = new Date()): CheckOutCommand {
  return {
    status: "completed",
    actual_check_out: now.toISOString(),
  };
}
