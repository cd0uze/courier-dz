// ─── Tracking Status ──────────────────────────────────────────────────────────

export const TRACKING_STATUS = Object.freeze({
  PENDING: 'pending',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  FAILED_DELIVERY: 'failed_delivery',
  RETURNING: 'returning',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
  READY_FOR_PICKUP: 'ready_for_pickup',
  EXCEPTION: 'exception',
  UNKNOWN: 'unknown',
});

const STATUS_LABELS_EN = {
  [TRACKING_STATUS.PENDING]: 'Pending',
  [TRACKING_STATUS.PICKED_UP]: 'Picked Up',
  [TRACKING_STATUS.IN_TRANSIT]: 'In Transit',
  [TRACKING_STATUS.OUT_FOR_DELIVERY]: 'Out for Delivery',
  [TRACKING_STATUS.DELIVERED]: 'Delivered',
  [TRACKING_STATUS.FAILED_DELIVERY]: 'Failed Delivery Attempt',
  [TRACKING_STATUS.RETURNING]: 'Returning to Sender',
  [TRACKING_STATUS.RETURNED]: 'Returned to Sender',
  [TRACKING_STATUS.CANCELLED]: 'Cancelled',
  [TRACKING_STATUS.READY_FOR_PICKUP]: 'Ready for Pickup',
  [TRACKING_STATUS.EXCEPTION]: 'Exception / Issue',
  [TRACKING_STATUS.UNKNOWN]: 'Unknown',
};

const STATUS_LABELS_FR = {
  [TRACKING_STATUS.PENDING]: 'En attente',
  [TRACKING_STATUS.PICKED_UP]: 'Collecté',
  [TRACKING_STATUS.IN_TRANSIT]: 'En transit',
  [TRACKING_STATUS.OUT_FOR_DELIVERY]: 'En cours de livraison',
  [TRACKING_STATUS.DELIVERED]: 'Livré',
  [TRACKING_STATUS.FAILED_DELIVERY]: 'Tentative de livraison échouée',
  [TRACKING_STATUS.RETURNING]: "En retour vers l'expéditeur",
  [TRACKING_STATUS.RETURNED]: "Retourné à l'expéditeur",
  [TRACKING_STATUS.CANCELLED]: 'Annulé',
  [TRACKING_STATUS.READY_FOR_PICKUP]: 'Disponible en point relais',
  [TRACKING_STATUS.EXCEPTION]: 'Exception / Problème',
  [TRACKING_STATUS.UNKNOWN]: 'Inconnu',
};

const STATUS_LABELS_AR = {
  [TRACKING_STATUS.PENDING]: 'قيد الانتظار',
  [TRACKING_STATUS.PICKED_UP]: 'تم الاستلام',
  [TRACKING_STATUS.IN_TRANSIT]: 'قيد النقل',
  [TRACKING_STATUS.OUT_FOR_DELIVERY]: 'قيد التوصيل',
  [TRACKING_STATUS.DELIVERED]: 'تم التوصيل',
  [TRACKING_STATUS.FAILED_DELIVERY]: 'فشل التوصيل',
  [TRACKING_STATUS.RETURNING]: 'قيد الإرجاع',
  [TRACKING_STATUS.RETURNED]: 'تم الإرجاع',
  [TRACKING_STATUS.CANCELLED]: 'تم الإلغاء',
  [TRACKING_STATUS.READY_FOR_PICKUP]: 'جاهز للاستلام',
  [TRACKING_STATUS.EXCEPTION]: 'استثناء / مشكلة',
  [TRACKING_STATUS.UNKNOWN]: 'غير معروف',
};

const STATUS_COLORS = {
  [TRACKING_STATUS.PENDING]: 'gray',
  [TRACKING_STATUS.PICKED_UP]: 'blue',
  [TRACKING_STATUS.IN_TRANSIT]: 'indigo',
  [TRACKING_STATUS.OUT_FOR_DELIVERY]: 'yellow',
  [TRACKING_STATUS.DELIVERED]: 'green',
  [TRACKING_STATUS.FAILED_DELIVERY]: 'orange',
  [TRACKING_STATUS.RETURNING]: 'amber',
  [TRACKING_STATUS.RETURNED]: 'red',
  [TRACKING_STATUS.CANCELLED]: 'red',
  [TRACKING_STATUS.READY_FOR_PICKUP]: 'teal',
  [TRACKING_STATUS.EXCEPTION]: 'rose',
  [TRACKING_STATUS.UNKNOWN]: 'gray',
};

const TERMINAL_STATUSES = new Set([
  TRACKING_STATUS.DELIVERED,
  TRACKING_STATUS.RETURNED,
  TRACKING_STATUS.CANCELLED,
]);

const ACTIVE_STATUSES = new Set([
  TRACKING_STATUS.PICKED_UP,
  TRACKING_STATUS.IN_TRANSIT,
  TRACKING_STATUS.OUT_FOR_DELIVERY,
  TRACKING_STATUS.RETURNING,
]);

/** Human-readable English label */
export function getStatusLabel(status) {
  return STATUS_LABELS_EN[status] ?? STATUS_LABELS_EN[TRACKING_STATUS.UNKNOWN];
}

/** Human-readable French label */
export function getStatusLabelFr(status) {
  return STATUS_LABELS_FR[status] ?? STATUS_LABELS_FR[TRACKING_STATUS.UNKNOWN];
}

/** Human-readable Arabic label */
export function getStatusLabelAr(status) {
  return STATUS_LABELS_AR[status] ?? STATUS_LABELS_AR[TRACKING_STATUS.UNKNOWN];
}

/** Color hint for badge rendering in UIs */
export function getStatusColor(status) {
  return STATUS_COLORS[status] ?? 'gray';
}

/** Whether this status is a final state */
export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

/** Whether this status indicates a successful delivery */
export function isSuccessfulStatus(status) {
  return status === TRACKING_STATUS.DELIVERED;
}

/** Whether the parcel is still moving */
export function isActiveStatus(status) {
  return ACTIVE_STATUSES.has(status);
}
