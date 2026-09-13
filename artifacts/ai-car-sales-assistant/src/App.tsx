import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarClock,
  CarFront,
  Gauge,
  Info,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

type Vehicle = {
  id: string;
  name: string;
  price: number;
  transmission: string;
  fuel: string;
  year: number;
};

type Message = {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  vehicleIds?: string[];
  actions?: string[];
  time: string;
};

type Lead = {
  name: string;
  phone: string;
  vehicle: string;
  budget: string;
  financing: string;
  testDrive: string;
};

const queryClient = new QueryClient();

const inventory: Vehicle[] = [
  { id: 'camry-2020', name: 'Toyota Camry 2020', price: 18500000, transmission: 'Automatic', fuel: 'Petrol', year: 2020 },
  { id: 'accord-2020', name: 'Honda Accord 2020', price: 17000000, transmission: 'Automatic', fuel: 'Petrol', year: 2020 },
  { id: 'rx-350-2019', name: 'Lexus RX 350 2019', price: 28000000, transmission: 'Automatic', fuel: 'Petrol', year: 2019 },
  { id: 'corolla-2021', name: 'Toyota Corolla 2021', price: 16500000, transmission: 'Automatic', fuel: 'Petrol', year: 2021 },
  { id: 'c300-2020', name: 'Mercedes-Benz C300 2020', price: 32000000, transmission: 'Automatic', fuel: 'Petrol', year: 2020 },
];

const initialMessages: Message[] = [
  {
    id: 1,
    role: 'assistant',
    text: 'Welcome. I can help you find the right car, compare prices, or arrange a conversation with a salesperson. What are you looking for today?',
    actions: ['Show available cars', 'I have a budget'],
    time: 'Now',
  },
];

const formatNaira = (amount: number) =>
  `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(amount)}`;

const nowLabel = () =>
  new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit' }).format(new Date());

function parseBudget(input: string) {
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
    const terms = vehicle.name.toLowerCase().split(' ');
    return lower.includes(vehicle.name.toLowerCase()) || terms.some((term) => term.length > 3 && lower.includes(term));
  });
}

function getAssistantResponse(input: string) {
  const lower = input.toLowerCase();
  const vehicle = findVehicle(input);
  const budget = parseBudget(input);
  const wantsDrive = /test drive|test-drive|drive it|book.*drive/.test(lower);
  const wantsPerson = /salesperson|sales person|human|agent|call me|speak to|contact me/.test(lower);
  const wantsFinance = /financ|installment|monthly|loan|payment plan/.test(lower);
  const wantsInventory = /available|inventory|cars|vehicles|what do you have|show me|options/.test(lower);

  if (wantsPerson) {
    return {
      text: 'Absolutely. I can pass your details to a salesperson so you can get a clear answer without repeating yourself. I just need your name and phone number to get started.',
      actions: ['Talk to a salesperson'],
    };
  }
  if (wantsDrive) {
    return {
      text: 'A test drive is a good next step. Choose a vehicle and a convenient time, and I will prepare the request for a salesperson.',
      actions: ['Book a test drive'],
    };
  }
  if (wantsFinance) {
    return {
      text: vehicle
        ? `For the ${vehicle.name}, a salesperson can walk you through available financing and monthly payment options. What budget would you like to keep your monthly payment within?`
        : 'Financing can be discussed with a salesperson based on your chosen car, deposit, and preferred monthly budget. Which vehicle are you considering, and what budget would you like to work with?',
      actions: ['Talk to a salesperson'],
    };
  }
  if (budget) {
    const matches = inventory.filter((item) => item.price <= budget);
    if (matches.length) {
      return {
        text: `I found ${matches.length} ${matches.length === 1 ? 'option' : 'options'} at or below ${formatNaira(budget)}. All listed vehicles are automatic and petrol. Which one would you like to explore?`,
        vehicleIds: matches.map((item) => item.id),
      };
    }
    return {
      text: `The current sample inventory starts at ${formatNaira(Math.min(...inventory.map((item) => item.price)))}. If you can stretch your budget, I can show the closest options or connect you with a salesperson.`,
      actions: ['Show available cars', 'Talk to a salesperson'],
    };
  }
  if (vehicle) {
    return {
      text: `${vehicle.name} is listed at ${formatNaira(vehicle.price)}. It has an ${vehicle.transmission.toLowerCase()} transmission and runs on ${vehicle.fuel.toLowerCase()}. Would you like to ask about financing or arrange a test drive?`,
      vehicleIds: [vehicle.id],
      actions: ['Ask about financing', 'Book a test drive'],
    };
  }
  if (wantsInventory) {
    return {
      text: 'Here is the full sample inventory. Tell me your preferred model or budget and I will narrow it down.',
      vehicleIds: inventory.map((item) => item.id),
    };
  }
  return {
    text: 'I can help with vehicle availability, prices, budgets, financing, salesperson contact, or test drives. This app only knows the vehicles in its sample inventory.',
    actions: ['Show available cars', 'Talk to a salesperson'],
  };
}

function VehicleCard({ vehicle, onSelect }: { vehicle: Vehicle; onSelect: (vehicle: Vehicle) => void }) {
  return (
    <button
      type="button"
      className="vehicle-card"
      onClick={() => onSelect(vehicle)}
      data-testid={`card-vehicle-${vehicle.id}`}
      aria-label={`Ask about ${vehicle.name}`}
    >
      <span className="vehicle-icon" aria-hidden="true"><CarFront size={22} strokeWidth={1.7} /></span>
      <span>
        <span className="vehicle-name">{vehicle.name}</span>
        <span className="vehicle-specs"><span>{vehicle.transmission}</span><span>•</span><span>{vehicle.fuel}</span></span>
      </span>
      <span className="vehicle-price">{formatNaira(vehicle.price)}</span>
    </button>
  );
}

function SalespersonModal({
  onClose,
  onSubmit,
  currentLead,
}: {
  onClose: () => void;
  onSubmit: (lead: Lead) => void;
  currentLead: Lead;
}) {
  const [form, setForm] = useState<Lead>(currentLead);
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Please add your name and phone number.');
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="salesperson-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="modal-eyebrow">Human connection</p><h2 id="salesperson-modal-title">Talk to a salesperson</h2></div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close salesperson form" data-testid="button-close-salesperson"><X size={17} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label htmlFor="lead-name">Your name</label><input id="lead-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Amaka Okafor" data-testid="input-lead-name" autoFocus /></div>
            <div className="field"><label htmlFor="lead-phone">Phone number</label><input id="lead-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="e.g. 0803 000 0000" data-testid="input-lead-phone" /></div>
            <div className="field"><label htmlFor="lead-vehicle">Vehicle of interest</label><select id="lead-vehicle" value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })} data-testid="select-lead-vehicle"><option value="Not decided">Not decided</option>{inventory.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></div>
            <div className="form-two-col">
              <div className="field"><label htmlFor="lead-budget">Budget</label><input id="lead-budget" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} placeholder="e.g. ₦20m" data-testid="input-lead-budget" /></div>
              <div className="field"><label htmlFor="lead-financing">Financing</label><select id="lead-financing" value={form.financing} onChange={(event) => setForm({ ...form, financing: event.target.value })} data-testid="select-lead-financing"><option>Not sure yet</option><option>Yes, please explain</option><option>No, paying outright</option></select></div>
            </div>
            <label className="checkbox-row"><input type="checkbox" checked={form.testDrive === 'Yes'} onChange={(event) => setForm({ ...form, testDrive: event.target.checked ? 'Yes' : 'Not requested' })} data-testid="checkbox-lead-test-drive" /> I would like to arrange a test drive</label>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <div className="modal-footer"><button type="button" className="outline-button" onClick={onClose} data-testid="button-cancel-salesperson">Cancel</button><button type="submit" className="primary-button" data-testid="button-submit-salesperson">Share my details <ArrowRight size={14} /></button></div>
        </form>
      </section>
    </div>
  );
}

function TestDriveModal({
  onClose,
  onSubmit,
  currentLead,
}: {
  onClose: () => void;
  onSubmit: (details: { vehicle: string; date: string; time: string; name: string; phone: string }) => void;
  currentLead: Lead;
}) {
  const [form, setForm] = useState({
    vehicle: currentLead.vehicle === 'Not decided' ? inventory[0].name : currentLead.vehicle,
    date: '',
    time: '',
    name: currentLead.name,
    phone: currentLead.phone,
  });
  const [error, setError] = useState('');
  const minimumDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.vehicle || !form.date || !form.time || !form.name.trim() || !form.phone.trim()) {
      setError('Please complete each field so the request is ready to share.');
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="test-drive-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="modal-eyebrow">On the road</p><h2 id="test-drive-modal-title">Book a test drive</h2></div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close test drive form" data-testid="button-close-test-drive"><X size={17} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label htmlFor="drive-vehicle">Vehicle</label><select id="drive-vehicle" value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })} data-testid="select-drive-vehicle">{inventory.map((item) => <option key={item.id}>{item.name}</option>)}</select></div>
            <div className="form-two-col">
              <div className="field"><label htmlFor="drive-date">Preferred date</label><input id="drive-date" type="date" min={minimumDate} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} data-testid="input-drive-date" /></div>
              <div className="field"><label htmlFor="drive-time">Preferred time</label><input id="drive-time" type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} data-testid="input-drive-time" /></div>
            </div>
            <div className="form-two-col">
              <div className="field"><label htmlFor="drive-name">Your name</label><input id="drive-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" data-testid="input-drive-name" /></div>
              <div className="field"><label htmlFor="drive-phone">Phone number</label><input id="drive-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone number" data-testid="input-drive-phone" /></div>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <div className="modal-footer"><button type="button" className="outline-button" onClick={onClose} data-testid="button-cancel-test-drive">Cancel</button><button type="submit" className="primary-button" data-testid="button-submit-test-drive">Request test drive <CalendarClock size={14} /></button></div>
        </form>
      </section>
    </div>
  );
}

function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [modal, setModal] = useState<'salesperson' | 'test-drive' | null>(null);
  const [lead, setLead] = useState<Lead>({
    name: '',
    phone: '',
    vehicle: 'Not decided',
    budget: 'Not specified',
    financing: 'Not sure yet',
    testDrive: 'Not requested',
  });
  const conversationRef = useRef<HTMLDivElement>(null);
  const responseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageId = useRef(10);

  useEffect(() => {
    const container = conversationRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => () => {
    if (responseTimer.current) clearTimeout(responseTimer.current);
  }, []);

  const openSalesperson = () => setModal('salesperson');
  const openTestDrive = () => setModal('test-drive');

  const addAssistantReply = (input: string) => {
    setIsTyping(true);
    if (responseTimer.current) clearTimeout(responseTimer.current);
    responseTimer.current = setTimeout(() => {
      const response = getAssistantResponse(input);
      setMessages((current) => [...current, { id: messageId.current++, role: 'assistant', ...response, time: nowLabel() }]);
      setIsTyping(false);
    }, 520);
  };

  const sendMessage = (value: string) => {
    const text = value.trim();
    if (!text || isTyping) return;
    setMessages((current) => [...current, { id: messageId.current++, role: 'user', text, time: nowLabel() }]);
    setDraft('');
    addAssistantReply(text);
  };

  const handleAction = (action: string) => {
    if (action.toLowerCase().includes('salesperson')) {
      openSalesperson();
      return;
    }
    if (action.toLowerCase().includes('test drive')) {
      openTestDrive();
      return;
    }
    sendMessage(action);
  };

  const saveLead = (nextLead: Lead) => {
    setLead(nextLead);
    setModal(null);
    setMessages((current) => [
      ...current,
      { id: messageId.current++, role: 'user', text: 'I would like to talk to a salesperson.', time: nowLabel() },
      { id: messageId.current++, role: 'assistant', text: `Thanks, ${nextLead.name.split(' ')[0] || 'there'}. Your details are ready for a salesperson. They can follow up on ${nextLead.vehicle === 'Not decided' ? 'your vehicle search' : nextLead.vehicle}.`, actions: ['Book a test drive'], time: nowLabel() },
    ]);
  };

  const saveTestDrive = (details: { vehicle: string; date: string; time: string; name: string; phone: string }) => {
    const readableDate = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(`${details.date}T12:00:00`));
    setLead((current) => ({ ...current, name: details.name, phone: details.phone, vehicle: details.vehicle, testDrive: `${readableDate} at ${details.time}` }));
    setModal(null);
    setMessages((current) => [
      ...current,
      { id: messageId.current++, role: 'user', text: `Book a test drive for the ${details.vehicle}.`, time: nowLabel() },
      { id: messageId.current++, role: 'assistant', text: `Your test-drive request for the ${details.vehicle} is noted for ${readableDate} at ${details.time}. A salesperson can confirm the appointment using the details you provided.`, actions: ['Talk to a salesperson'], time: nowLabel() },
    ]);
  };

  return (
    <main className="app-shell">
      <div className="app-frame">
        <aside className="brand-rail" aria-label="Product information">
          <div>
            <a className="brand-lockup" href="/" data-testid="link-brand-home">
              <span className="brand-mark"><CarFront size={21} strokeWidth={1.7} /></span>
              <span><span className="brand-name">Drivewise</span><span className="brand-subtitle">Showroom concierge</span></span>
            </a>
            <div className="rail-intro">
              <p className="rail-kicker">Your next move</p>
              <h1 className="rail-title">A calmer way to find your car.</h1>
              <p className="rail-copy">Ask a question in plain language. Get a useful answer, a short list, or a clear next step.</p>
            </div>
            <ul className="rail-list">
              <li><ShieldCheck size={15} /> Straightforward vehicle details</li>
              <li><Gauge size={15} /> Quick budget matching</li>
              <li><Phone size={15} /> A simple handoff to a human</li>
            </ul>
          </div>
          <div className="rail-footer"><span className="status-dot" /> <span>Concierge online<br />Ready when you are</span></div>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div className="topbar-label">
              <span className="online-avatar" aria-hidden="true"><Bot size={20} strokeWidth={1.6} /></span>
              <div><p className="topbar-title">Your car concierge</p><div className="topbar-meta"><span className="status-dot" /> Usually replies in seconds</div></div>
            </div>
            <div className="topbar-actions"><div className="notice-pill" data-testid="text-demo-notice"><Info size={14} /> Demo using sample vehicle data.</div></div>
          </header>

          <div className="workspace-grid">
            <section className="chat-column" aria-label="Chat with car concierge">
              <div className="conversation" ref={conversationRef} aria-live="polite">
                <div className="day-divider">Today</div>
                {messages.map((message) => (
                  <div className={`message-row ${message.role}`} key={message.id} data-testid={`message-${message.role}-${message.id}`}>
                    {message.role === 'assistant' && <span className="message-avatar" aria-hidden="true"><Sparkles size={14} /></span>}
                    <div className="message-stack">
                      <div className="message-bubble">{message.text}</div>
                      {message.vehicleIds && (
                        <div className="vehicle-grid" data-testid="list-vehicle-results">
                          {message.vehicleIds.map((id) => {
                            const vehicle = inventory.find((item) => item.id === id);
                            return vehicle ? <VehicleCard key={vehicle.id} vehicle={vehicle} onSelect={(selected) => sendMessage(`Tell me about the ${selected.name}`)} /> : null;
                          })}
                        </div>
                      )}
                      {message.actions && <div className="message-actions">{message.actions.map((action) => <button type="button" className="quick-chip" key={action} onClick={() => handleAction(action)} data-testid={`button-action-${action.toLowerCase().replaceAll(' ', '-')}`}>{action}</button>)}</div>}
                      <span className="message-time">{message.time}</span>
                    </div>
                    {message.role === 'user' && <span className="message-avatar user" aria-hidden="true"><UserRound size={14} /></span>}
                  </div>
                ))}
                {isTyping && <div className="message-row" data-testid="status-assistant-typing"><span className="message-avatar" aria-hidden="true"><Sparkles size={14} /></span><div className="message-stack"><div className="message-bubble typing-bubble" aria-label="Assistant is typing"><span /><span /><span /></div></div></div>}
              </div>
              <div className="composer-wrap">
                <div className="composer">
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(draft); } }} placeholder="Ask about a car, price, or next step..." aria-label="Message car concierge" rows={1} data-testid="input-chat-message" />
                  <button type="button" className="send-button" onClick={() => sendMessage(draft)} disabled={!draft.trim() || isTyping} aria-label="Send message" data-testid="button-send-message"><Send size={16} /></button>
                </div>
                <p className="composer-hint">Press Enter to send · Shift + Enter for a new line</p>
              </div>
            </section>

            <aside className="summary-panel" aria-label="Lead summary">
              <div className="summary-heading"><div><p className="panel-eyebrow">Your enquiry</p><h2>Lead summary</h2></div><span className="summary-badge">{lead.name ? 'In progress' : 'Open'}</span></div>
              <div className={`summary-card ${lead.name ? '' : 'empty'}`}>
                <p className="summary-card-title"><BadgeCheck size={15} /> {lead.name ? 'Details captured' : 'Nothing saved yet'}</p>
                {lead.name ? <dl className="summary-list">
                  <div className="summary-row"><dt>Customer</dt><dd data-testid="text-lead-name">{lead.name}</dd></div>
                  <div className="summary-row"><dt>Phone</dt><dd data-testid="text-lead-phone">{lead.phone}</dd></div>
                  <div className="summary-row"><dt>Vehicle</dt><dd data-testid="text-lead-vehicle">{lead.vehicle}</dd></div>
                  <div className="summary-row"><dt>Budget</dt><dd data-testid="text-lead-budget">{lead.budget}</dd></div>
                  <div className="summary-row"><dt>Financing</dt><dd data-testid="text-lead-financing">{lead.financing}</dd></div>
                  <div className="summary-row"><dt>Test drive</dt><dd data-testid="text-lead-test-drive">{lead.testDrive}</dd></div>
                </dl> : <p className="summary-placeholder">Share your details when you are ready. Your preferences will stay visible here for an easy handoff.</p>}
              </div>
              <button type="button" className="primary-button" onClick={openSalesperson} data-testid="button-talk-salesperson"><MessageCircle size={15} /> Talk to a salesperson</button>
              <button type="button" className="outline-button" onClick={openTestDrive} data-testid="button-book-test-drive"><CalendarClock size={15} /> Book a test drive</button>
              <div className="help-card"><p className="panel-eyebrow">Prefer a quick call?</p><p>Tell us what you are looking for and a salesperson can pick up from there.</p><button type="button" className="outline-button" onClick={openSalesperson} data-testid="button-start-handoff">Start a handoff <ArrowRight size={14} /></button></div>
            </aside>
          </div>
        </section>
      </div>
      {modal === 'salesperson' && <SalespersonModal currentLead={lead} onClose={() => setModal(null)} onSubmit={saveLead} />}
      {modal === 'test-drive' && <TestDriveModal currentLead={lead} onClose={() => setModal(null)} onSubmit={saveTestDrive} />}
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;