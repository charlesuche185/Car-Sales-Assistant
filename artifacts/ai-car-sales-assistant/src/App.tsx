import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bot,
  CalendarDays,
  CalendarClock,
  CarFront,
  ChevronRight,
  CircleCheck,
  Clock3,
  Fuel,
  Gauge,
  Info,
  LayoutDashboard,
  MessageCircle,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { inventory, type Vehicle } from '@workspace/car-inventory';

type Message = {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  vehicleIds?: string[];
  actions?: string[];
  time: string;
};

type AssistantResponse = Pick<Message, 'text' | 'vehicleIds' | 'actions'>;
type AssistantMode = 'ai' | 'demo';

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'TEST DRIVE' | 'CLOSED';

type Lead = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  budget: string;
  payment: string;
  testDrive: string;
  additionalMessage: string;
  status: LeadStatus;
  date: string;
};

type View = 'chat' | 'inventory' | 'dashboard';
type Modal = 'lead' | 'test-drive' | 'finance' | 'details' | null;

const queryClient = new QueryClient();

const demoLeads: Lead[] = [
  { id: 'demo-1', name: 'Chioma Eze', phone: '0803 482 9201', vehicle: 'Toyota Camry 2020', budget: '₦18M–₦20M', payment: 'Financing', testDrive: 'Requested', additionalMessage: '', status: 'NEW', date: 'Today, 09:42' },
  { id: 'demo-2', name: 'Tunde Balogun', phone: '0816 770 1140', vehicle: 'Lexus RX 350 2019', budget: '₦28M', payment: 'Cash / outright', testDrive: 'Not requested', additionalMessage: '', status: 'CONTACTED', date: 'Yesterday' },
  { id: 'demo-3', name: 'Amaka Okafor', phone: '0706 221 8834', vehicle: 'Hyundai Elantra 2021', budget: '₦15M', payment: 'Cash / outright', testDrive: 'Not requested', additionalMessage: '', status: 'QUALIFIED', date: '12 Sep 2026' },
  { id: 'demo-4', name: 'Ibrahim Musa', phone: '0902 114 5062', vehicle: 'Honda Accord 2020', budget: '₦17M–₦18M', payment: 'Financing', testDrive: 'Sat, 14 Sep · 11:00', additionalMessage: '', status: 'TEST DRIVE', date: '11 Sep 2026' },
  { id: 'demo-5', name: 'Sarah Adeyemi', phone: '0809 005 7341', vehicle: 'Toyota Corolla 2021', budget: '₦16.5M', payment: 'Cash / outright', testDrive: 'Completed', additionalMessage: '', status: 'CLOSED', date: '08 Sep 2026' },
];

const initialMessages: Message[] = [
  {
    id: 1,
    role: 'assistant',
    text: 'Welcome to AutoAssist AI. I can help you browse our sample inventory, compare prices, answer vehicle questions, or prepare a request for a salesperson. What are you looking for today?',
    actions: ['Browse Cars', 'Cars Under ₦20M', 'Financing'],
    time: 'Now',
  },
];

const formatNaira = (amount: number) =>
  `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(amount)}`;

const formatMileage = (mileage: number) =>
  `${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(mileage)} km`;

const nowLabel = () =>
  new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit' }).format(new Date());

const todayLabel = () =>
  new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());

function parseBudget(input: string) {
  if (!/(?:₦|ngn|under|below|budget|million|\bm\b|price|less than|max)/i.test(input)) return null;
  const match = input.toLowerCase().match(/(?:₦|ngn)?\s*([\d,.]+)\s*(million|m)?/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  if (match[2] || value < 1000) return value * 1_000_000;
  return value;
}

function findVehicle(input: string) {
  const lower = input.toLowerCase();
  return inventory.find((vehicle) => {
    const [make, model, year] = vehicle.name.toLowerCase().split(' ');
    return lower.includes(vehicle.name.toLowerCase()) ||
      (lower.includes(make) && lower.includes(model) && lower.includes(year));
  });
}

function parseMileageMax(input: string) {
  if (!/(?:mileage|miles|km)/i.test(input)) return null;
  const match = input.toLowerCase().match(/(?:under|below|less than|max(?:imum)?)\s*([\d,.]+)\s*(k|km|thousand)?/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  return match[2] === 'k' || match[2] === 'thousand' || value < 1000 ? value * 1_000 : value;
}

function getAssistantResponse(input: string, history: Message[] = []): AssistantResponse {
  const lower = input.toLowerCase();
  const rememberedUserText = history
    .filter((message) => message.role === 'user')
    .map((message) => message.text)
    .join(' ');
  const context = `${rememberedUserText} ${input}`.trim();
  const vehicle = findVehicle(context);
  const budget = parseBudget(context);
  const mileageMax = parseMileageMax(input);
  const yearMatch = context.match(/\b(2019|2020|2021)\b/);
  const wantsDrive = /test drive|test-drive|drive it|book.*drive/.test(lower);
  const wantsPerson = /salesperson|sales person|human|agent|call me|speak to|contact me|talk to sales/.test(lower);
  const wantsFinance = /financ|installment|monthly|loan|payment plan|deposit/.test(lower);
  const wantsInventory = /available|inventory|cars|vehicles|what do you have|show me|options|browse/.test(lower);
  const wantsSpecs = /mileage|miles|transmission|gear|fuel|petrol|year|specification|specs/.test(lower);
  const brand = ['toyota', 'honda', 'lexus', 'mercedes', 'hyundai'].find((name) => context.toLowerCase().includes(name));
  const wantsFamilyCar = /family|children|kids|reliable/.test(lower);
  const wantsLowestMileage = /lowest|least|min(?:imum)?/.test(lower) && /mileage|miles|km/.test(lower);

  if (wantsPerson) {
    return {
      text: 'Absolutely. I can prepare a lead for a salesperson so you do not have to repeat yourself. I will just need your contact details and a little information about the car you are considering.',
      actions: ['Talk to Sales'],
    };
  }
  if (wantsDrive) {
    return {
      text: 'A test drive is a good next step. Choose a vehicle and a convenient date and time, and I will prepare the request for a salesperson.',
      actions: ['Book a Test Drive'],
    };
  }
  if (wantsFinance) {
    return {
      text: vehicle
        ? `For the ${vehicle.name}, a salesperson can explain available financing options based on your deposit and preferred payment period. I can capture the enquiry now.`
        : 'I can capture a financing enquiry for a salesperson. Which vehicle are you considering, and what budget or deposit would you like to work with?',
      actions: ['Start Financing Enquiry', 'Talk to Sales'],
      vehicleIds: vehicle ? [vehicle.id] : undefined,
    };
  }
  if (budget) {
    let matches = inventory.filter((item) => item.price <= budget);
    if (brand) matches = matches.filter((item) => item.name.toLowerCase().includes(brand));
    if (/automatic/.test(lower)) matches = matches.filter((item) => item.transmission.toLowerCase() === 'automatic');
    if (/manual/.test(lower)) matches = matches.filter((item) => item.transmission.toLowerCase() === 'manual');
    if (/diesel/.test(lower)) matches = matches.filter((item) => item.fuel.toLowerCase() === 'diesel');
    if (/petrol/.test(lower)) matches = matches.filter((item) => item.fuel.toLowerCase() === 'petrol');
    if (/around|about|close to/.test(lower)) {
      const nearby = inventory.filter((item) =>
        item.price >= budget * 0.8 &&
        item.price <= budget * 1.2 &&
        (!brand || item.name.toLowerCase().includes(brand)) &&
        (!/automatic/.test(lower) || item.transmission.toLowerCase() === 'automatic'),
      );
      if (nearby.length) matches = nearby;
    }
    if (wantsFamilyCar) {
      const familyIds = new Set(['camry-2020', 'accord-2020', 'corolla-2021', 'rx-350-2019']);
      const familyMatches = inventory.filter((item) => familyIds.has(item.id));
      const withinBudget = familyMatches.filter((item) => item.price <= budget);
      const nextClosest = familyMatches
        .filter((item) => item.price > budget && item.price <= budget * 1.1)
        .sort((a, b) => a.price - b.price);
      const familyOptions = [...withinBudget, ...nextClosest];
      if (familyOptions.length) {
        return {
          text: `Based on our demo inventory, ${familyOptions.map((item) => `${item.name} is ${formatNaira(item.price)}`).join(' and ')}. ${withinBudget.length ? `${withinBudget.map((item) => item.name).join(' and ')} ${withinBudget.length === 1 ? 'is' : 'are'} within your stated budget.` : 'These are the closest family-car matches to your stated budget.'} Would you like to see the details?`,
          vehicleIds: familyOptions.map((item) => item.id),
          actions: ['Talk to Sales', 'Book a Test Drive'],
        };
      }
    }
    if (matches.length) {
      return {
        text: `I found ${matches.length} ${matches.length === 1 ? 'option' : 'options'} in the sample inventory at or below ${formatNaira(budget)}${brand ? ` from ${brand.charAt(0).toUpperCase() + brand.slice(1)}` : ''}:\n${matches.map((item) => `• ${item.name} — ${formatNaira(item.price)}`).join('\n')}\nWhich one would you like to explore?`,
        vehicleIds: matches.map((item) => item.id),
        actions: ['Talk to Sales'],
      };
    }
    return {
      text: `The closest match in the sample inventory is ${formatNaira(Math.min(...inventory.map((item) => item.price)))}. I can show the full list or connect you with a salesperson to discuss options.`,
      actions: ['Browse Cars', 'Talk to Sales'],
    };
  }
  if (wantsLowestMileage) {
    const lowest = [...inventory].sort((a, b) => a.mileage - b.mileage)[0];
    return {
      text: `The lowest-mileage vehicle in our sample inventory is the ${lowest.name} with ${formatMileage(lowest.mileage)}. Would you like to see its details?`,
      vehicleIds: [lowest.id],
      actions: ['Talk to Sales', 'Book a Test Drive'],
    };
  }
  if (wantsFamilyCar) {
    const familyIds = ['camry-2020', 'accord-2020', 'corolla-2021', 'rx-350-2019'];
    return {
      text: 'For a family car, I would start with the Toyota Camry, Honda Accord, Toyota Corolla, or Lexus RX from our sample inventory. Tell me your budget and I can narrow that down.',
      vehicleIds: familyIds,
      actions: ['Cars Under ₦20M', 'Talk to Sales'],
    };
  }
  if (brand) {
    const matches = inventory.filter((item) => item.name.toLowerCase().includes(brand));
    return {
      text: `We have ${matches.length} sample ${brand.charAt(0).toUpperCase() + brand.slice(1)} ${matches.length === 1 ? 'vehicle' : 'vehicles'}:\n${matches.map((item) => `• ${item.name} — ${formatNaira(item.price)}`).join('\n')}\nWould you like me to compare them?`,
      vehicleIds: matches.map((item) => item.id),
      actions: ['Talk to Sales'],
    };
  }
  if (!vehicle && (mileageMax || yearMatch || /automatic|manual|petrol|diesel/.test(lower))) {
    const matches = inventory.filter((item) =>
      (!mileageMax || item.mileage <= mileageMax) &&
      (!yearMatch || item.year === Number(yearMatch[1])) &&
      (!/manual/.test(lower) || item.transmission.toLowerCase() === 'manual') &&
      (!/automatic/.test(lower) || item.transmission.toLowerCase() === 'automatic') &&
      (!/diesel/.test(lower) || item.fuel.toLowerCase() === 'diesel') &&
      (!/petrol/.test(lower) || item.fuel.toLowerCase() === 'petrol'),
    );
    if (matches.length) {
      return {
        text: `I found ${matches.length} ${matches.length === 1 ? 'vehicle' : 'vehicles'} matching those specifications in the sample inventory. Which one would you like to explore?`,
        vehicleIds: matches.map((item) => item.id),
      };
    }
    return {
      text: 'I could not find a vehicle matching those specifications in the sample inventory. I can show the full list or help you compare another model.',
      actions: ['Browse Cars', 'Talk to Sales'],
    };
  }
  if (vehicle) {
    return {
      text: `${vehicle.name} is listed at ${formatNaira(vehicle.price)}. It has ${formatMileage(vehicle.mileage)} on the odometer, an ${vehicle.transmission.toLowerCase()} transmission, and runs on ${vehicle.fuel.toLowerCase()}. Would you like to ask about financing or arrange a test drive?`,
      vehicleIds: [vehicle.id],
      actions: ['Ask about Financing', 'Book a Test Drive'],
    };
  }
  if (wantsSpecs) {
    return {
      text: 'I can share year, mileage, transmission, fuel type, and price for a specific vehicle. Which model would you like to know more about?',
      actions: ['Browse Cars', 'Talk to Sales'],
    };
  }
  if (wantsInventory) {
    return {
      text: 'Here is the full sample inventory. Tell me your preferred model, specification, or budget and I will narrow it down.',
      vehicleIds: inventory.map((item) => item.id),
    };
  }
  return {
    text: 'I can help with vehicle availability, prices, budgets, year, mileage, transmission, fuel type, financing, salesperson contact, or test drives. This demo only knows the vehicles in its sample inventory.',
    actions: ['Browse Cars', 'Cars Under ₦20M', 'Talk to Sales'],
  };
}

function VehicleImage({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="vehicle-image" aria-hidden="true">
      <div className="vehicle-image-glow" />
      <CarFront size={38} strokeWidth={1.15} />
      <span>DEMO VEHICLE</span>
    </div>
  );
}

function VehicleCard({
  vehicle,
  onDetails,
  onInterested,
  compact = false,
}: {
  vehicle: Vehicle;
  onDetails: (vehicle: Vehicle) => void;
  onInterested: (vehicle: Vehicle) => void;
  compact?: boolean;
}) {
  return (
    <article className={`vehicle-card ${compact ? 'compact' : ''}`} data-testid={`card-vehicle-${vehicle.id}`}>
      {!compact && <VehicleImage vehicle={vehicle} />}
      <div className="vehicle-card-body">
        <div className="vehicle-card-topline">
          <span className="sample-tag">SAMPLE VEHICLE</span>
          <span className="vehicle-year">{vehicle.year}</span>
        </div>
        <h3>{vehicle.name.replace(` ${vehicle.year}`, '')}</h3>
        <p className="vehicle-price">{formatNaira(vehicle.price)}</p>
        <div className="vehicle-spec-grid">
          <span><Gauge size={13} /> {formatMileage(vehicle.mileage)}</span>
          <span><ShieldCheck size={13} /> {vehicle.transmission}</span>
          <span><Fuel size={13} /> {vehicle.fuel}</span>
        </div>
        <div className="vehicle-card-actions">
          <button type="button" className="outline-button small" onClick={() => onDetails(vehicle)} data-testid={`button-view-details-${vehicle.id}`}>View Details <ChevronRight size={13} /></button>
          <button type="button" className="accent-button small" onClick={() => onInterested(vehicle)} data-testid={`button-interested-${vehicle.id}`}>I'm Interested</button>
        </div>
      </div>
    </article>
  );
}

function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="modal-eyebrow">{eyebrow}</p><h2 id="modal-title">{title}</h2></div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={`Close ${title}`}><X size={17} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function VehicleDetailsModal({
  vehicle,
  onClose,
  onInterested,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onInterested: (vehicle: Vehicle) => void;
}) {
  return (
    <ModalShell title={vehicle.name} eyebrow="Sample vehicle · Demo data" onClose={onClose}>
      <VehicleImage vehicle={vehicle} />
      <div className="detail-price-row"><div><span className="detail-label">Asking price</span><strong>{formatNaira(vehicle.price)}</strong></div><span className="detail-status"><CircleCheck size={13} /> Available in demo</span></div>
      <div className="detail-specs">
        <div><Gauge size={16} /><span><b>Mileage</b>{formatMileage(vehicle.mileage)}</span></div>
        <div><ShieldCheck size={16} /><span><b>Transmission</b>{vehicle.transmission}</span></div>
        <div><Fuel size={16} /><span><b>Fuel type</b>{vehicle.fuel}</span></div>
        <div><CalendarDays size={16} /><span><b>Year</b>{vehicle.year}</span></div>
      </div>
      <p className="detail-note">This vehicle card is part of the AutoAssist AI demo. A salesperson can confirm availability and answer any additional questions.</p>
      <div className="modal-footer"><button type="button" className="outline-button" onClick={onClose}>Close</button><button type="button" className="primary-button" onClick={() => onInterested(vehicle)}>I'm Interested <ArrowRight size={14} /></button></div>
    </ModalShell>
  );
}

function LeadFormModal({
  initialVehicle,
  onClose,
  onSubmit,
}: {
  initialVehicle?: Vehicle;
  onClose: () => void;
  onSubmit: (lead: Omit<Lead, 'id' | 'date' | 'status'>) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    vehicle: initialVehicle?.name ?? 'Not decided',
    budget: '',
    payment: 'Not decided',
    testDrive: '',
    additionalMessage: '',
  });
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || form.vehicle === 'Not decided') {
      setError('Please add your name, phone number, and vehicle of interest.');
      return;
    }
    onSubmit({ ...form, budget: form.budget || 'Not specified', testDrive: form.testDrive || 'Not requested' });
  };
  return (
    <ModalShell title="Talk to a salesperson" eyebrow="Capture a qualified lead" onClose={onClose}>
      <p className="modal-intro">Share a few details and a salesperson can pick up the conversation with context.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="lead-name">Full name *</label><input id="lead-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Amaka Okafor" autoFocus /></div>
          <div className="field"><label htmlFor="lead-phone">Phone number *</label><input id="lead-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="e.g. 0803 000 0000" /></div>
          <div className="field"><label htmlFor="lead-vehicle">Vehicle interested in *</label><select id="lead-vehicle" value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })}><option value="Not decided">Select a vehicle</option>{inventory.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></div>
          <div className="form-two-col">
            <div className="field"><label htmlFor="lead-budget">Estimated budget</label><input id="lead-budget" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} placeholder="e.g. ₦20M" /></div>
            <div className="field"><label htmlFor="lead-payment">Payment preference</label><select id="lead-payment" value={form.payment} onChange={(event) => setForm({ ...form, payment: event.target.value })}><option>Not decided</option><option>Cash / outright</option><option>Financing</option></select></div>
          </div>
          <div className="field"><label htmlFor="lead-test-drive">Preferred test-drive date</label><input id="lead-test-drive" type="date" min={new Date().toISOString().split('T')[0]} value={form.testDrive} onChange={(event) => setForm({ ...form, testDrive: event.target.value })} /></div>
          <div className="field"><label htmlFor="lead-message">Additional message</label><textarea id="lead-message" value={form.additionalMessage} onChange={(event) => setForm({ ...form, additionalMessage: event.target.value })} placeholder="Anything the salesperson should know?" rows={3} /></div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="modal-footer"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Capture lead <ArrowRight size={14} /></button></div>
      </form>
    </ModalShell>
  );
}

function TestDriveModal({
  initialVehicle,
  onClose,
  onSubmit,
}: {
  initialVehicle?: Vehicle;
  onClose: () => void;
  onSubmit: (lead: Omit<Lead, 'id' | 'date' | 'status'>) => void;
}) {
  const [form, setForm] = useState({ name: '', phone: '', vehicle: initialVehicle?.name ?? inventory[0].name, date: '', time: '' });
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.date || !form.time) {
      setError('Please complete your name, phone, date, and preferred time.');
      return;
    }
    const readableDate = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(`${form.date}T12:00:00`));
    onSubmit({ name: form.name, phone: form.phone, vehicle: form.vehicle, budget: 'Not specified', payment: 'Not decided', testDrive: `${readableDate} · ${form.time}`, additionalMessage: 'Test drive request' });
  };
  return (
    <ModalShell title="Book a Test Drive" eyebrow="Request received by demo dashboard" onClose={onClose}>
      <p className="modal-intro">Choose a vehicle and preferred time. A salesperson can confirm the appointment.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="drive-vehicle">Vehicle *</label><select id="drive-vehicle" value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })}>{inventory.map((item) => <option key={item.id}>{item.name}</option>)}</select></div>
          <div className="form-two-col"><div className="field"><label htmlFor="drive-name">Name *</label><input id="drive-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" autoFocus /></div><div className="field"><label htmlFor="drive-phone">Phone *</label><input id="drive-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone number" /></div></div>
          <div className="form-two-col"><div className="field"><label htmlFor="drive-date">Preferred date *</label><input id="drive-date" type="date" min={new Date().toISOString().split('T')[0]} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></div><div className="field"><label htmlFor="drive-time">Preferred time *</label><input id="drive-time" type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></div></div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="modal-footer"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Request test drive <CalendarClock size={14} /></button></div>
      </form>
    </ModalShell>
  );
}

function FinanceModal({
  initialVehicle,
  onClose,
  onSubmit,
}: {
  initialVehicle?: Vehicle;
  onClose: () => void;
  onSubmit: (lead: Omit<Lead, 'id' | 'date' | 'status'>) => void;
}) {
  const [form, setForm] = useState({ name: '', phone: '', vehicle: initialVehicle?.name ?? 'Not decided', budget: '', deposit: '', period: '' });
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || form.vehicle === 'Not decided') {
      setError('Please add your name, phone number, and vehicle of interest.');
      return;
    }
    onSubmit({ name: form.name, phone: form.phone, vehicle: form.vehicle, budget: form.budget || 'Not specified', payment: 'Financing', testDrive: 'Not requested', additionalMessage: `Deposit: ${form.deposit || 'Not specified'} · Preferred period: ${form.period || 'Not specified'}` });
  };
  return (
    <ModalShell title="Financing enquiry" eyebrow="No financial advice · Demo only" onClose={onClose}>
      <p className="modal-intro">Capture the basics for a salesperson. They can explain available options; this demo does not provide financial advice or approvals.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="form-two-col"><div className="field"><label htmlFor="finance-name">Name *</label><input id="finance-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" autoFocus /></div><div className="field"><label htmlFor="finance-phone">Phone *</label><input id="finance-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone number" /></div></div>
          <div className="field"><label htmlFor="finance-vehicle">Vehicle *</label><select id="finance-vehicle" value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })}><option value="Not decided">Select a vehicle</option>{inventory.map((item) => <option key={item.id}>{item.name}</option>)}</select></div>
          <div className="form-two-col"><div className="field"><label htmlFor="finance-budget">Estimated budget</label><input id="finance-budget" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} placeholder="e.g. ₦20M" /></div><div className="field"><label htmlFor="finance-deposit">Deposit available</label><input id="finance-deposit" value={form.deposit} onChange={(event) => setForm({ ...form, deposit: event.target.value })} placeholder="e.g. ₦5M" /></div></div>
          <div className="field"><label htmlFor="finance-period">Preferred payment period</label><select id="finance-period" value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })}><option value="">Select a period</option><option>12 months</option><option>24 months</option><option>36 months</option><option>Not sure yet</option></select></div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="modal-footer"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Submit enquiry <ArrowRight size={14} /></button></div>
      </form>
    </ModalShell>
  );
}

function StatCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof CarFront; tone: string }) {
  return <div className={`stat-card ${tone}`}><span className="stat-icon"><Icon size={17} /></span><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></div>;
}

function Dashboard({ leads, onStatusChange }: { leads: Lead[]; onStatusChange: (id: string, status: LeadStatus) => void }) {
  return (
    <section className="dashboard-view">
      <div className="view-heading"><div><p className="section-kicker">Demo workspace</p><h1>Dealer Dashboard</h1><p>See how AutoAssist AI turns conversations into organized next steps.</p></div><span className="demo-badge"><CircleCheck size={13} /> DEMO MODE</span></div>
      <div className="stat-grid">
        <StatCard label="Total Leads" value="24" detail="+12% this month" icon={MessageCircle} tone="navy" />
        <StatCard label="New Leads" value="8" detail="Needs attention" icon={Sparkles} tone="amber" />
        <StatCard label="Test Drives" value="5" detail="3 this week" icon={CalendarClock} tone="green" />
        <StatCard label="Financing Enquiries" value="7" detail="Ready for follow-up" icon={Banknote} tone="blue" />
      </div>
      <div className="dashboard-card">
        <div className="card-heading"><div><p className="section-kicker">Live demo data</p><h2>Recent enquiries</h2></div><span className="table-count">{leads.length} shown</span></div>
        <div className="lead-table-wrap">
          <table className="lead-table"><thead><tr><th>Customer</th><th>Vehicle</th><th>Budget</th><th>Payment</th><th>Status</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td><strong>{lead.name}</strong><span>{lead.phone}</span></td><td>{lead.vehicle}</td><td>{lead.budget}</td><td>{lead.payment}</td><td><span className={`status-pill ${lead.status.toLowerCase().replaceAll(' ', '-')}`}>{lead.status}</span></td><td>{lead.date}</td><td><div className="row-actions">{lead.status === 'NEW' && <button type="button" onClick={() => onStatusChange(lead.id, 'CONTACTED')}>Mark Contacted</button>}{lead.status === 'CONTACTED' && <button type="button" onClick={() => onStatusChange(lead.id, 'QUALIFIED')}>Mark Qualified</button>}{lead.status === 'QUALIFIED' && <button type="button" onClick={() => onStatusChange(lead.id, 'TEST DRIVE')}>Move to Test Drive</button>}</div></td></tr>)}</tbody></table>
        </div>
      </div>
      <div className="dashboard-note"><Info size={16} /><span>All names, phone numbers, vehicles, and statistics on this dashboard are fictional sample data for demonstration purposes.</span></div>
    </section>
  );
}

function Home() {
  const [activeView, setActiveView] = useState<View>('chat');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | undefined>();
  const [leads, setLeads] = useState<Lead[]>(demoLeads);
  const [inventorySearch, setInventorySearch] = useState('');
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('demo');
  const conversationRef = useRef<HTMLDivElement>(null);
  const messageId = useRef(10);

  useEffect(() => {
    const container = conversationRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isTyping]);

  const filteredInventory = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    if (!query) return inventory;
    return inventory.filter((vehicle) => `${vehicle.name} ${vehicle.year} ${vehicle.fuel}`.toLowerCase().includes(query));
  }, [inventorySearch]);

  const openModal = (nextModal: Modal, vehicle?: Vehicle) => {
    setSelectedVehicle(vehicle);
    setModal(nextModal);
  };

  const requestAiResponse = async (input: string, history: Message[]): Promise<AssistantResponse | null> => {
    const apiPath = `${import.meta.env.BASE_URL.replace(/\/?$/, '/') }api/ai/chat`;
    try {
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: history.slice(-12).map((message) => ({ role: message.role, content: message.text })),
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) return null;
      const payload = await response.json() as {
        mode?: AssistantMode;
        text?: unknown;
        vehicleIds?: unknown;
        actions?: unknown;
      };
      if (payload.mode !== 'ai' || typeof payload.text !== 'string') return null;
      return {
        text: payload.text,
        vehicleIds: Array.isArray(payload.vehicleIds) ? payload.vehicleIds.filter((id): id is string => typeof id === 'string') : undefined,
        actions: Array.isArray(payload.actions) ? payload.actions.filter((action): action is string => typeof action === 'string') : undefined,
      };
    } catch {
      return null;
    }
  };

  const addAssistantReply = async (input: string, history: Message[]) => {
    setIsTyping(true);
    const aiResponse = await requestAiResponse(input, history);
    const response = aiResponse ?? getAssistantResponse(input, history);
    setAssistantMode(aiResponse ? 'ai' : 'demo');
    setMessages((current) => [...current, { id: messageId.current++, role: 'assistant', ...response, time: nowLabel() }]);
    setIsTyping(false);
  };

  const sendMessage = (value: string) => {
    const text = value.trim();
    if (!text || isTyping) return;
    setActiveView('chat');
    setMessages((current) => [...current, { id: messageId.current++, role: 'user', text, time: nowLabel() }]);
    setDraft('');
    addAssistantReply(text, messages);
  };

  const handleAction = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes('talk to sales') || lower.includes('salesperson')) {
      openModal('lead');
      return;
    }
    if (lower.includes('test drive')) {
      openModal('test-drive');
      return;
    }
    if (lower.includes('financing enquiry')) {
      openModal('finance');
      return;
    }
    if (lower === 'browse cars') {
      setActiveView('inventory');
      return;
    }
    sendMessage(action);
  };

  const appendLeadConfirmation = (lead: Lead, confirmation: string) => {
    setLeads((current) => [lead, ...current]);
    setModal(null);
    setActiveView('chat');
    setMessages((current) => [
      ...current,
      { id: messageId.current++, role: 'user', text: confirmation, time: nowLabel() },
      { id: messageId.current++, role: 'assistant', text: `Lead captured successfully. Thanks, ${lead.name.split(' ')[0] || 'there'}. The demo dashboard now has the details for ${lead.vehicle}.`, actions: ['Book a Test Drive', 'Browse Cars'], time: nowLabel() },
    ]);
  };

  const saveLead = (details: Omit<Lead, 'id' | 'date' | 'status'>) => {
    appendLeadConfirmation({ ...details, id: `lead-${Date.now()}`, status: 'NEW', date: todayLabel() }, 'I would like to talk to a salesperson.');
  };

  const saveTestDrive = (details: Omit<Lead, 'id' | 'date' | 'status'>) => {
    appendLeadConfirmation({ ...details, id: `drive-${Date.now()}`, status: 'TEST DRIVE', date: todayLabel() }, `Book a test drive for the ${details.vehicle}.`);
  };

  const saveFinance = (details: Omit<Lead, 'id' | 'date' | 'status'>) => {
    appendLeadConfirmation({ ...details, id: `finance-${Date.now()}`, status: 'NEW', date: todayLabel() }, `I have a financing enquiry for the ${details.vehicle}.`);
  };

  const markLeadStatus = (id: string, status: LeadStatus) => {
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, status } : lead));
  };

  const scrollToHowItWorks = () => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  const latestLead = leads[0];
  const hasCapturedLead = Boolean(latestLead && !latestLead.id.startsWith('demo-'));

  return (
    <main className="app-shell">
      <div className="app-frame">
        <aside className="brand-rail" aria-label="AutoAssist AI information">
          <div>
            <div className="brand-lockup"><span className="brand-mark"><CarFront size={21} strokeWidth={1.7} /></span><span><span className="brand-name">AutoAssist AI</span><span className="brand-subtitle">AI Sales Assistant</span></span></div>
            <div className="rail-intro"><p className="rail-kicker">For dealerships</p><h2 className="rail-title">More conversations. Better leads.</h2><p className="rail-copy">Helping dealerships answer enquiries, qualify buyers and capture leads 24/7.</p></div>
            <div className="rail-feature-list"><div><span><MessageCircle size={15} /></span><p><b>Answer fast</b><small>Respond to common questions</small></p></div><div><span><BadgeCheck size={15} /></span><p><b>Qualify intent</b><small>Capture what buyers need</small></p></div><div><span><LayoutDashboard size={15} /></span><p><b>Stay organized</b><small>Keep every lead in view</small></p></div></div>
          </div>
          <div className="rail-footer"><span className="status-dot" /><span>Assistant online<br />Demo environment</span></div>
        </aside>

        <section className="product-area">
          <header className="app-header">
            <div className="header-brand"><span className="mobile-brand-mark"><CarFront size={18} /></span><div><p>AutoAssist AI</p><span>AI Sales Assistant for Car Dealerships</span></div></div>
            <div className="header-actions"><button type="button" className="header-link" onClick={() => setActiveView('dashboard')}><LayoutDashboard size={15} /> Dealer Dashboard</button><span className="header-demo"><Info size={13} /> DEMO MODE</span></div>
          </header>
          <nav className="main-nav" aria-label="Primary navigation"><button type="button" className={activeView === 'chat' ? 'active' : ''} onClick={() => setActiveView('chat')}><MessageCircle size={15} /> Chat Assistant</button><button type="button" className={activeView === 'inventory' ? 'active' : ''} onClick={() => setActiveView('inventory')}><CarFront size={15} /> Browse Cars <span>{inventory.length}</span></button><button type="button" className={activeView === 'dashboard' ? 'active' : ''} onClick={() => setActiveView('dashboard')}><LayoutDashboard size={15} /> Dealer Dashboard</button></nav>

          {activeView === 'chat' && <section className="chat-view">
            <div className="chat-intro"><div><p className="section-kicker">Customer conversation</p><h1>Your dealership's first response, handled.</h1><p>Ask about vehicles, budgets, financing, or the next step. AutoAssist AI keeps the conversation moving.</p></div><span className="online-badge"><span className="status-dot" /> Assistant online</span></div>
            <div className="quick-actions" aria-label="Quick actions"><span>Try a quick action</span><button type="button" onClick={() => setActiveView('inventory')}><CarFront size={14} /> Browse Cars</button><button type="button" onClick={() => sendMessage('Show me cars under ₦20M')}><Gauge size={14} /> Cars Under ₦20M</button><button type="button" onClick={() => sendMessage('I want to ask about financing')}><Banknote size={14} /> Financing</button><button type="button" onClick={() => openModal('test-drive')}><CalendarClock size={14} /> Book a Test Drive</button><button type="button" onClick={() => openModal('lead')}><Phone size={14} /> Talk to Sales</button></div>
            <div className="chat-layout">
              <section className="chat-card" aria-label="Chat with AutoAssist AI">
                 <div className="chat-card-header"><div className="assistant-identity"><span className="assistant-avatar"><Bot size={19} /></span><div><strong>AutoAssist AI</strong><span>Typically replies in seconds</span></div></div><div className="chat-status-labels"><span className={`mode-indicator ${assistantMode === 'ai' ? 'connected' : ''}`}><Sparkles size={12} /> {assistantMode === 'ai' ? 'AI-powered assistant' : 'Demo mode'}</span><span className="secure-label"><ShieldCheck size={13} /> Sample data only</span></div></div>
                <div className="conversation" ref={conversationRef} aria-live="polite"><div className="day-divider">Today</div>{messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}>{message.role === 'assistant' && <span className="message-avatar"><Sparkles size={14} /></span>}<div className="message-stack"><div className="message-bubble">{message.text}</div>{message.vehicleIds && <div className="chat-vehicle-grid">{message.vehicleIds.map((id) => { const vehicle = inventory.find((item) => item.id === id); return vehicle ? <VehicleCard key={vehicle.id} vehicle={vehicle} compact onDetails={(selected) => openModal('details', selected)} onInterested={(selected) => openModal('lead', selected)} /> : null; })}</div>}{message.actions && <div className="message-actions">{message.actions.map((action) => <button type="button" className="quick-chip" key={action} onClick={() => handleAction(action)}>{action}<ArrowRight size={12} /></button>)}</div>}<span className="message-time">{message.time}</span></div>{message.role === 'user' && <span className="message-avatar user"><UserRound size={14} /></span>}</div>)}{isTyping && <div className="message-row" data-testid="status-assistant-typing"><span className="message-avatar"><Sparkles size={14} /></span><div className="message-stack"><div className="message-bubble typing-bubble"><span /><span /><span /></div></div></div>}</div>
                <div className="composer-wrap"><div className="composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(draft); } }} placeholder="Ask about a car, price, or next step..." aria-label="Message AutoAssist AI" rows={1} /><button type="button" className="send-button" onClick={() => sendMessage(draft)} disabled={!draft.trim() || isTyping} aria-label="Send message"><Send size={16} /></button></div><p className="composer-hint">Press Enter to send · Shift + Enter for a new line</p></div>
              </section>
              <aside className="lead-preview"><div className="preview-heading"><div><p className="section-kicker">Sales handoff</p><h2>Lead summary</h2></div><span className="open-pill">{hasCapturedLead ? latestLead.status : 'OPEN'}</span></div>{hasCapturedLead && latestLead ? <div className="captured-preview"><p><CircleCheck size={15} /> Lead captured successfully.</p><dl><div><dt>Name</dt><dd>{latestLead.name}</dd></div><div><dt>Vehicle</dt><dd>{latestLead.vehicle}</dd></div><div><dt>Payment</dt><dd>{latestLead.payment}</dd></div></dl></div> : <div className="empty-preview"><BadgeCheck size={17} /><p><strong>Ready when they are.</strong>Customer details and preferences appear here after a handoff.</p></div>}<button type="button" className="primary-button" onClick={() => openModal('lead')}><MessageCircle size={15} /> Talk to Sales</button><button type="button" className="outline-button" onClick={() => openModal('test-drive')}><CalendarClock size={15} /> Book a Test Drive</button><div className="demo-notice"><Info size={15} /><p><strong>DEMO MODE</strong> All vehicles and customer information shown are fictional.</p></div></aside>
            </div>
            <section className="how-it-works" id="how-it-works"><div><p className="section-kicker">Built for the front line</p><h2>How AutoAssist AI Helps Dealerships</h2><p>Give every enquiry a helpful first response, even when the team is busy.</p></div><div className="benefit-grid"><div><span><Clock3 size={17} /></span><b>24/7 Customer Responses</b><p>Answer common questions any time.</p></div><div><span><BadgeCheck size={17} /></span><b>Capture More Leads</b><p>Turn interest into useful contact details.</p></div><div><span><Gauge size={17} /></span><b>Qualify Serious Buyers</b><p>Understand budget and intent earlier.</p></div><div><span><Sparkles size={17} /></span><b>Reduce Repetitive Enquiries</b><p>Let your team focus on closing.</p></div></div><button type="button" className="text-button" onClick={scrollToHowItWorks}>See How It Works <ArrowRight size={14} /></button></section>
          </section>}

          {activeView === 'inventory' && <section className="inventory-view"><div className="view-heading"><div><p className="section-kicker">Sample inventory</p><h1>Browse Cars</h1><p>Explore the vehicles AutoAssist AI can discuss with customers.</p></div><span className="demo-badge"><ShieldCheck size={13} /> SAMPLE VEHICLE DATA</span></div><div className="inventory-toolbar"><div className="search-field"><Search size={16} /><input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Search make, model, year..." aria-label="Search sample vehicles" /></div><span>{filteredInventory.length} of {inventory.length} vehicles</span></div><div className="inventory-grid">{filteredInventory.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} onDetails={(selected) => openModal('details', selected)} onInterested={(selected) => openModal('lead', selected)} />)}</div>{filteredInventory.length === 0 && <div className="empty-state"><CarFront size={25} /><h2>No vehicles found</h2><p>Try another make, model, or year.</p></div>}<div className="inventory-footer"><Info size={15} /> Every vehicle shown is fictional sample data created for this demonstration.</div></section>}

          {activeView === 'dashboard' && <Dashboard leads={leads} onStatusChange={markLeadStatus} />}
        </section>
      </div>
      {modal === 'details' && selectedVehicle && <VehicleDetailsModal vehicle={selectedVehicle} onClose={() => setModal(null)} onInterested={(vehicle) => openModal('lead', vehicle)} />}
      {modal === 'lead' && <LeadFormModal initialVehicle={selectedVehicle} onClose={() => setModal(null)} onSubmit={saveLead} />}
      {modal === 'test-drive' && <TestDriveModal initialVehicle={selectedVehicle} onClose={() => setModal(null)} onSubmit={saveTestDrive} />}
      {modal === 'finance' && <FinanceModal initialVehicle={selectedVehicle} onClose={() => setModal(null)} onSubmit={saveFinance} />}
    </main>
  );
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;