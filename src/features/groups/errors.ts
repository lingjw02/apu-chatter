const messages:Record<string,string>={
 FORBIDDEN:'You do not have permission to do that.',NOT_MEMBER:'You are no longer a member of this group.',
 OWNER_PROTECTED:'The group owner cannot be removed.',OWNER_REQUIRED:'Only the owner can allow a removed admin back.',
 TRANSFER_OWNERSHIP_FIRST:'Transfer ownership to another member before leaving.',INVALID_TARGET:'That member cannot be targeted by this action.',
 VOTE_COOLDOWN:'A previous vote did not pass. Wait seven days after it ended before starting another vote about this member.',
 VOTE_ALREADY_OPEN:'There is already an open vote about this member. Open Votes to participate.',VOTE_CLOSED:'This vote has ended. Refresh the group to see its outcome.',
 NOT_ELIGIBLE:'You are not eligible to vote in this session.',ALREADY_VOTED:'Your ballot has already been recorded and cannot be changed.',
};
export function groupError(error:unknown):string {const message=typeof error==='object'&&error&&'message'in error?String(error.message):'Unable to update the group. Please try again.';return messages[message]||message;}
