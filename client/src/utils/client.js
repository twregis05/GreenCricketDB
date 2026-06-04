export const clientName = (c) =>
  c?.clientType === 'group'
    ? c.groupName || 'Unnamed Group'
    : `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || 'Unnamed';

export const clientInitials = (c) =>
  c?.clientType === 'group'
    ? (c.groupName || 'G').slice(0, 2).toUpperCase()
    : `${(c?.firstName || '?')[0]}${(c?.lastName || '?')[0]}`.toUpperCase();
