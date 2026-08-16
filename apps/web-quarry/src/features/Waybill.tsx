import { PublicWaybill } from '@karier/ui';
import { useParams } from 'react-router-dom';

/** Parolsiz yuk xati — where the QR printed on the document leads. */
export function Waybill() {
  const { tripId } = useParams();
  return <PublicWaybill tripId={tripId ?? ''} />;
}
