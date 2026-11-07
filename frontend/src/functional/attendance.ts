import { isEasternToday } from "@/functional/time";

type AttendanceTimes = {
    signInTime: Date | string | null | undefined;
    signOutTime: Date | string | null | undefined;
};

/**
 * Whether the member is currently in the center.
 * Open sessions from a previous Eastern calendar day are treated as signed out
 * (matches backend day-rollover settlement).
 */
export const isMemberSignedIn = (member: AttendanceTimes): boolean => {
    const { signInTime, signOutTime } = member;
    if (!signInTime) return false;
    if (!isEasternToday(signInTime)) return false;
    if (!signOutTime) return true;
    return new Date(signInTime) > new Date(signOutTime);
};
