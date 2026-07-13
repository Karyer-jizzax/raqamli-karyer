import { M1Table } from './DataM1';

/** "Hodisalar" page: the raw M-1 event log over every quarry the department
 *  can see (no quarry_id — the backend scopes rows to the user's region). */
export function Events() {
  return (
    <div className="p-6">
      <M1Table />
    </div>
  );
}
