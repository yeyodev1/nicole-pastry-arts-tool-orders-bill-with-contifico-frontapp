import type { OrderFormData, CartItem } from '@/types/order'

export function generateOrderSummary(order: any): string {
  const productsString = order.products
    .map((p: any) => `${p.quantity} x ${p.name}`)
    .join("\n");

  const deliveryDateFormatted = new Date(order.deliveryDate).toLocaleDateString('es-EC');

  // Construct "Type of Order" string
  // e.g. "Delivery saliendo de - Ceibos" or "Retiro en local - San Marino"
  let typeOfOrder = "";
  if (order.deliveryType === 'retiro') {
    typeOfOrder = `Retiro en local - ${order.branch || 'S/N'}`;
  } else {
    typeOfOrder = `Delivery saliendo de - ${order.branch || 'S/N'}`;
  }

  // Strict Format Matching Backend
  return `
CONFIRMACIÓN DE PEDIDO - NICOLE PASTRY

Tipo de Orden: ${typeOfOrder}

Cliente: ${order.customerName}

Cédula/RUC: ${order.invoiceData?.ruc || "N/A"}

Correo: ${order.invoiceData?.email || "N/A"}

Celular: ${order.customerPhone}

Fecha de Entrega: ${deliveryDateFormatted}

Hora de Entrega/Retiro: ${order.deliveryTime}

Items (Nombre Contífico):

${productsString}

Dirección de Entrega: ${order.deliveryType === 'delivery' ? order.deliveryAddress : 'N/A (Retiro)'}

Link Maps: ${order.googleMapsLink || 'N/A'}
    `.trim();
}
