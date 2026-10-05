import { conflict } from '../utils/app-error.js';

const transitions = {
  quotation: { DRAFT: ['SENT'], SENT: ['ACCEPTED', 'REJECTED'], ACCEPTED: [], REJECTED: [] },
  salesOrder: { PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['DISPATCHED'], DISPATCHED: [], CANCELLED: [] },
};

export function assertTransition(machine, from, to) {
  if (!transitions[machine]?.[from]?.includes(to)) {
    throw conflict(`Cannot change ${machine} from ${from} to ${to}`, 'INVALID_STATE');
  }
}

