// ─── Delivery Type ────────────────────────────────────────────────────────────

export const DELIVERY_TYPE = Object.freeze({
  HOME: 1,
  STOP_DESK: 2,
});

export function getDeliveryTypeLabel(type) {
  switch (type) {
    case DELIVERY_TYPE.HOME:
      return 'Home Delivery';
    case DELIVERY_TYPE.STOP_DESK:
      return 'Stop Desk / Pick-up Point';
    default:
      return 'Unknown';
  }
}

export function getDeliveryTypeLabelFr(type) {
  switch (type) {
    case DELIVERY_TYPE.HOME:
      return 'Livraison à domicile';
    case DELIVERY_TYPE.STOP_DESK:
      return 'Stop desk / Point relais';
    default:
      return 'Inconnu';
  }
}

export function getDeliveryTypeLabelAr(type) {
  switch (type) {
    case DELIVERY_TYPE.HOME:
      return 'توصيل للمنزل';
    case DELIVERY_TYPE.STOP_DESK:
      return 'توصيل للمكتب';
    default:
      return 'غير معروف';
  }
}
