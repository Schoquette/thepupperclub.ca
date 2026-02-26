# The Pupper Club — Client Portal & Mobile App
## Product Requirements Document (PRD)
### Version 1.0 | Ready for Claude Code / Developer Handoff

---

## 1. Project Overview

### 1.1 Product Summary
A full-stack web portal and companion mobile app for The Pupper Club, a premium subscription dog walking service based in Port Moody, BC. The system serves two roles:
- **Admin (Sophie):** Manages all clients, scheduling, billing, and communications
- **Client (Pet Parents):** Views appointments, receives visit updates, manages profile, communicates, and pays invoices

### 1.2 Design Principles
- Mobile-first. Clients will primarily use the app; admin will use both web and mobile.
- Brand-consistent: Cream `#F6F3EE`, Espresso `#3B2F2A`, Taupe `#C8BFB6`, Soft Gold `#C9A24D`, Blue `#6492D8`. Fonts: Playfair Display SC (headings), Alleron/Lato (body).
- Calm, premium UX. No clutter. Every screen should feel intentional and unrushed.
- Notifications are central to the experience — they drive the visit lifecycle.

### 1.3 Recommended Tech Stack
```
Frontend (Web):     React + TypeScript, TailwindCSS, React Query
Mobile App:         React Native (Expo) — iOS + Android, shared codebase with web where possible
Backend:            Node.js + Express (or Next.js API routes), TypeScript
Database:           PostgreSQL (via Supabase or PlanetScale)
Auth:               Supabase Auth (email/password + magic link)
Push Notifications: Expo Push Notifications (mobile) + email (SendGrid/Resend)
Payments:           Stripe (subscriptions, ACH, credit card, invoicing)
File Storage:       Supabase Storage or AWS S3
Real-time/Chat:     Supabase Realtime (WebSockets for messaging)
Hosting:            Vercel (web) + Expo EAS (mobile builds)
```

---

## 2. Data Models

### 2.1 User
```typescript
User {
  id: uuid (PK)
  email: string (unique)
  phone: string
  role: enum('admin', 'client')
  status: enum('active', 'inactive', 'pending') // pending = invited, not yet logged in
  created_at: timestamp
  last_login: timestamp
}
```

### 2.2 ClientProfile
```typescript
ClientProfile {
  id: uuid (PK)
  user_id: uuid (FK -> User)
  first_name: string
  last_name: string
  address: string
  address_unit: string | null
  city: string
  postal_code: string
  emergency_contact_name: string
  emergency_contact_phone: string
  notes: string | null  // admin-only notes
  subscription_tier: enum('essential_30','essential_60','signature_30','signature_60','premier_60')
  subscription_start_date: date
  stripe_customer_id: string
  stripe_subscription_id: string | null
  billing_method: enum('ach', 'credit_card', 'manual')
  created_at: timestamp
  updated_at: timestamp
}
```

### 2.3 HomeAccess
```typescript
HomeAccess {
  id: uuid (PK)
  client_id: uuid (FK -> ClientProfile)
  access_type: enum('key', 'lockbox', 'door_code', 'garage_code', 'other')
  instructions: string
  lockbox_code: string | null  // encrypted
  door_code: string | null     // encrypted
  garage_code: string | null   // encrypted
  key_location_note: string | null
  alarm_instructions: string | null
  lockbox_deposit_paid: boolean
  special_notes: string | null
  updated_at: timestamp
}
```

### 2.4 Dog
```typescript
Dog {
  id: uuid (PK)
  client_id: uuid (FK -> ClientProfile)
  name: string
  breed: string
  date_of_birth: date | null
  weight_lbs: number | null
  sex: enum('male', 'female')
  is_neutered: boolean
  color_markings: string
  microchip_number: string | null
  photo_url: string | null
  vet_name: string
  vet_phone: string
  vet_address: string
  medical_conditions: string | null
  medications: Medication[]
  allergies: string | null
  vaccination_status: VaccinationRecord[]
  behaviour_notes: string  // triggers, fears, reactive to, good with kids/dogs/cats
  bite_history: boolean
  bite_history_details: string | null
  walking_preferences: string  // leash type, harness, pace, preferred routes
  feeding_instructions: string | null
  favourite_treats: string | null
  post_walk_routine: string | null
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}

Medication {
  name: string
  dose: string
  frequency: string
  instructions: string
}

VaccinationRecord {
  vaccine: string
  date_administered: date
  expiry_date: date | null
}
```

### 2.5 Appointment
```typescript
Appointment {
  id: uuid (PK)
  client_id: uuid (FK -> ClientProfile)
  dog_ids: uuid[]  // supports multi-dog
  service_type: enum('walk_30', 'walk_60', 'walk_90', 'drop_in', 'boarding', 'house_sitting')
  status: enum('scheduled', 'in_progress', 'completed', 'cancelled', 'requested', 'declined')
  scheduled_date: date
  scheduled_time: time  // admin-visible only (exact)
  client_time_block: enum('morning', 'midday', 'afternoon', 'evening')  // 3-hr window shown to client
  duration_minutes: number
  is_recurring: boolean
  recurrence_rule: RecurrenceRule | null
  recurrence_parent_id: uuid | null  // links single occurrence to its series
  special_requests: string[]  // selected from predefined list
  special_requests_other: string | null
  admin_notes: string | null
  client_address_snapshot: string  // snapshot at time of booking
  pre_visit_notification_sent: boolean
  arrival_notification_sent: boolean
  completion_notification_sent: boolean
  created_at: timestamp
  updated_at: timestamp
}

RecurrenceRule {
  frequency: enum('weekly')
  days_of_week: number[]  // 0=Sun, 1=Mon, etc.
  interval: number  // every N weeks
  end_date: date | null
}
```

### 2.6 VisitReport
```typescript
VisitReport {
  id: uuid (PK)
  appointment_id: uuid (FK -> Appointment)
  check_in_time: timestamp
  check_out_time: timestamp | null
  gps_route: GpsPoint[] | null  // optional sharing
  report_notes: string
  photos: string[]  // storage URLs
  peed: boolean | null
  pooped: boolean | null
  ate: boolean | null
  drank: boolean | null
  mood_rating: number | null  // 1-5
  admin_private_notes: string | null
  sent_at: timestamp | null
}

GpsPoint {
  lat: number
  lng: number
  timestamp: timestamp
}
```

### 2.7 Message / Conversation
```typescript
Conversation {
  id: uuid (PK)
  client_id: uuid (FK -> ClientProfile)
  appointment_id: uuid | null  // if visit-linked; null = general thread
  created_at: timestamp
}

Message {
  id: uuid (PK)
  conversation_id: uuid (FK -> Conversation)
  sender_role: enum('admin', 'client')
  content: string | null
  message_type: enum('text', 'visit_report', 'notification', 'arrival', 'pre_visit_prompt', 'invoice')
  media_urls: string[]
  quick_reply_options: QuickReply[] | null  // for structured prompts
  quick_reply_selected: string | null  // client's selection
  read_at: timestamp | null
  created_at: timestamp
}

QuickReply {
  label: string
  value: string
}
```

### 2.8 ServiceRequest
```typescript
ServiceRequest {
  id: uuid (PK)
  client_id: uuid (FK -> ClientProfile)
  dog_ids: uuid[]
  service_type: enum('walk_30', 'walk_60', 'walk_90', 'drop_in', 'boarding', 'house_sitting', 'extended_time')
  requested_date: date
  requested_time_block: enum('morning', 'midday', 'afternoon', 'evening')
  notes: string | null
  status: enum('pending', 'approved', 'declined', 'counter_proposed')
  admin_response_note: string | null
  counter_proposed_date: date | null
  counter_proposed_time_block: string | null
  created_at: timestamp
  resolved_at: timestamp | null
}
```

### 2.9 Invoice & Payment
```typescript
Invoice {
  id: uuid (PK)
  client_id: uuid (FK -> ClientProfile)
  invoice_number: string  // e.g. TPC-2025-0042
  status: enum('draft', 'sent', 'paid', 'overdue', 'voided')
  invoice_type: enum('subscription', 'additional_service', 'deposit', 'manual')
  line_items: LineItem[]
  subtotal_cad: number
  gst_amount: number  // 5%
  surcharge_amount: number  // 2.9% if credit card
  surcharge_applied: boolean
  tip_amount: number
  total_cad: number
  due_date: date
  billing_period_start: date | null
  billing_period_end: date | null
  stripe_invoice_id: string | null
  stripe_payment_intent_id: string | null
  paid_at: timestamp | null
  paid_method: enum('stripe_ach', 'stripe_card', 'etransfer', 'manual') | null
  notes: string | null
  created_at: timestamp
}

LineItem {
  description: string
  quantity: number
  unit_price_cad: number
  amount_cad: number
  appointment_id: uuid | null
}
```

### 2.10 Document
```typescript
ClientDocument {
  id: uuid (PK)
  client_id: uuid (FK -> ClientProfile)
  dog_id: uuid | null  // if dog-specific (e.g. vet records)
  name: string
  file_url: string
  file_type: string  // mime type
  file_size_bytes: number
  uploaded_by: enum('admin', 'client')
  document_category: enum('agreement', 'vet_record', 'vaccination', 'waiver', 'other')
  created_at: timestamp
}
```

### 2.11 Notification
```typescript
PushNotification {
  id: uuid (PK)
  recipient_user_id: uuid | null  // null = broadcast
  recipient_scope: enum('individual', 'all_clients')
  title: string
  body: string
  data: object | null  // deep link payload
  sent_at: timestamp
  channels: enum('push', 'email', 'in_app')[]
  opened_at: timestamp | null
}
```

---

## 3. Feature Modules & User Stories

---

### MODULE 1: Authentication & User Management

#### 1.1 Admin Invites a Client
**Description:** Admin creates the client account and sends login credentials. Client does not self-register.

**User Stories:**
- `[ADM-001]` As admin, I can create a new client profile by entering their name, email, and phone, so that their account is ready before I send credentials.
- `[ADM-002]` As admin, I can send a "Welcome" email invitation from within the admin dashboard that includes a temporary password and a link to the portal, so the client can log in for the first time.
- `[ADM-003]` As admin, I can see a list of pending (invited but not yet logged in) clients, so I know who hasn't onboarded yet.
- `[ADM-004]` As admin, I can resend an invitation email to a pending client at any time.
- `[CLT-001]` As a new client, when I click my invitation link, I am prompted to set a new password before accessing my portal.

**Business Rules:**
- Clients cannot self-register. The `/signup` route must not exist or must be admin-gated.
- Invitation links expire after 7 days; admin can regenerate.
- Initial temporary password must be auto-generated (min. 12 chars, not reused).

**API Endpoints:**
```
POST   /api/admin/clients/invite       — create user + send invite email
POST   /api/admin/clients/:id/resend-invite
PATCH  /api/auth/set-password          — client sets password on first login
```

---

#### 1.2 Password Reset
**User Stories:**
- `[ADM-005]` As admin, I can reset any client's password from the client list, sending them a password reset email.
- `[CLT-002]` As a client, I can request a password reset from the login screen if I forget my password.
- `[CLT-003]` As a client, I can change my own password from my account settings at any time.

**Business Rules:**
- Password reset links expire after 1 hour.
- Admin-triggered resets bypass the expiry check in the admin dashboard flow.

**API Endpoints:**
```
POST   /api/auth/forgot-password       — sends reset email (client-initiated)
POST   /api/admin/clients/:id/reset-password  — admin-triggered reset
POST   /api/auth/reset-password        — processes new password with token
```

---

### MODULE 2: Client & Dog Profiles

#### 2.1 Client Profile Management
**User Stories:**
- `[ADM-010]` As admin, I can view, create, and edit any client's profile including contact info, address, home access details, and notes.
- `[ADM-011]` As admin, I have a private notes field on each client profile that is not visible to the client.
- `[ADM-012]` As admin, I can see a full audit log of changes made to a client profile (who changed what, and when).
- `[CLT-010]` As a client, I can view and update my own contact information, emergency contact, and preferences at any time from the app or portal.
- `[CLT-011]` As a client, when I update my profile, the admin receives an in-app and email notification that a change was made, with a summary of what changed.

**Business Rules:**
- Clients cannot edit: subscription tier, billing info (must contact admin), admin notes.
- Address changes trigger an admin notification as they affect visit routing.
- All profile changes are timestamped and logged.

---

#### 2.2 Home Access Information
**User Stories:**
- `[ADM-020]` As admin, I can record home access details (lockbox code, door code, garage code, key location, alarm instructions) on a client's profile.
- `[ADM-021]` Home access details are encrypted at rest and only visible to the admin role.
- `[CLT-020]` As a client, I can view and update my home access instructions from my profile.
- `[CLT-021]` As a client, I can see whether a lockbox deposit has been paid.

**Business Rules:**
- Sensitive codes (lockbox, door, alarm) are encrypted at rest using AES-256.
- Clients can update access info; each change triggers an admin notification.
- A `$50 CAD` lockbox deposit is tracked manually by admin and reflected on the client profile.

---

#### 2.3 Dog Profile Management
**User Stories:**
- `[ADM-030]` As admin, I can create, view, edit, and deactivate dog profiles linked to a client.
- `[ADM-031]` As admin, I can upload a photo for any dog.
- `[ADM-032]` As admin, I can record full medical, behavioural, and care details for each dog.
- `[CLT-030]` As a client, I can view my dog's profile and all their information.
- `[CLT-031]` As a client, I can update my dog's information (feeding, vet details, behavioural notes, medications) at any time.
- `[CLT-032]` As a client, I can add a new dog to my profile; this triggers an admin notification and sets the new dog's status to "pending review" until admin activates it.
- `[CLT-033]` As a client, when I update my dog's profile, the admin receives a notification with a diff of what changed.

**Business Rules:**
- New dogs added by clients are NOT automatically added to upcoming appointments. Admin must manually add them.
- Bite history `= true` surfaces a visible warning banner on the admin's appointment card for that client.
- Vaccination records: admin can flag if a vaccination is expired; the system auto-flags if `expiry_date < today`.

---

#### 2.4 Intake Form
**User Stories:**
- `[ADM-040]` As admin, I can send a digital intake form link to a new client as part of their onboarding email.
- `[CLT-040]` As a new client, I can complete the intake form online which pre-populates my client and dog profile fields.
- `[ADM-041]` As admin, I can review submitted intake data before it is confirmed and pushed to the live profile.
- `[ADM-042]` As admin, I can manually edit any intake-submitted data before confirming.

**Business Rules:**
- The intake form covers: owner contact info, emergency contact, home access, dog(s) details, vet info, behavioural history, care preferences, and e-signature for service agreement.
- Intake submission does not auto-activate the client account. Admin must review and confirm.
- Signed service agreement from intake is automatically saved as a Document in the client's profile.

**Intake Form Sections:**
1. Owner Information (name, phone, email, address, emergency contact)
2. Home Access (access type, codes, special instructions)
3. Dog Information (one or more dogs, all fields from Dog model)
4. Veterinarian Information
5. Behavioural & Medical Disclosure
6. Care Preferences (walking style, treat preferences, post-walk routine)
7. Service Agreement (display full agreement, e-signature capture)
8. Payment Method Setup (Stripe integration to save ACH or card on file)

---

#### 2.5 Document Management
**User Stories:**
- `[ADM-050]` As admin, I can upload documents to a client's profile (signed agreements, vet records, waivers, etc.).
- `[ADM-051]` As admin, I can categorize and label uploaded documents.
- `[ADM-052]` As admin, I can delete or archive documents.
- `[CLT-050]` As a client, I can view documents that have been shared with me (e.g., signed agreements).
- `[CLT-051]` As a client, I can upload documents to my profile (e.g., vaccination records, updated vet paperwork).
- `[CLT-052]` Client-uploaded documents trigger an admin notification.

**Business Rules:**
- Accepted file types: PDF, JPG, PNG, HEIC, DOCX.
- Max file size: 10 MB per file.
- Documents uploaded by admin have visibility toggles: `admin_only` or `shared_with_client`.
- Client-uploaded documents are always visible to admin.

---

### MODULE 3: Calendar & Scheduling

#### 3.1 Admin Calendar View
**User Stories:**
- `[ADM-100]` As admin, I can view a full calendar (day, week, month views) showing all scheduled appointments.
- `[ADM-101]` Each calendar event shows: client name, dog name(s), service type, exact time, and service address.
- `[ADM-102]` As admin, I can click any appointment to open a detail panel showing: full address (with map link), dog profile(s), special instructions, special requests submitted by client, and all care notes.
- `[ADM-103]` From the appointment detail panel, I can navigate directly to the client or dog profile with one tap.
- `[ADM-104]` As admin, I can create, edit, and delete appointments from the calendar.
- `[ADM-105]` As admin, when creating a recurring appointment, I can set the recurring days, start time, and duration; all future occurrences are auto-generated.
- `[ADM-106]` As admin, when editing a recurring appointment, I can choose to edit only the single occurrence or all future occurrences.
- `[ADM-107]` As admin, I can view all pending service requests from clients as a separate list/badge in the calendar view.
- `[ADM-108]` As admin, I can see a 15-minute buffer block rendered between appointments on my calendar (non-bookable time).

**Business Rules:**
- All appointments have a mandatory 15-minute buffer. The system prevents scheduling an appointment that starts within 15 minutes of another's end time.
- Exact appointment times are only visible to the admin role.
- Recurring appointments default to weekly on the same day(s) at the same time.
- Admin can set a maximum of 3 appointments in the same time block (based on business capacity).

---

#### 3.2 Client Calendar View
**User Stories:**
- `[CLT-100]` As a client, I can see all of my upcoming appointments in a list or calendar view.
- `[CLT-101]` Each appointment shows: date, service type, dog name(s), and a 3-hour time block (e.g., "Morning 9am–12pm") — NOT the exact time.
- `[CLT-102]` As a client, I can tap an appointment to see its details and status.
- `[CLT-103]` As a client, I can request to cancel or reschedule a single future appointment (not the whole series).

**Time Block Mapping:**
```
early_morning:  7:00 AM – 10:00 AM
morning:        9:00 AM – 12:00 PM
midday:         11:00 AM – 2:00 PM
afternoon:      2:00 PM – 5:00 PM
evening:        5:00 PM – 8:00 PM
```
*Exact times are derived from admin scheduling and mapped to the nearest block for client display.*

---

#### 3.3 Appointment Change Requests
**User Stories:**
- `[CLT-110]` As a client, I can request to reschedule a specific appointment by selecting a preferred new date and time block, with an optional note.
- `[CLT-111]` As a client, I can request to cancel a specific appointment. The system shows a reminder of the cancellation policy (30 days for membership cancellation; individual appointments may be adjusted).
- `[CLT-112]` As a client, I can request to add an additional one-time service (select service type, preferred time block, notes).
- `[CLT-113]` As a client, I can see the status of all my pending requests (awaiting approval, approved, declined).
- `[ADM-110]` As admin, I receive a push and email notification for any client change request.
- `[ADM-111]` As admin, I can approve, decline, or counter-propose a new time for any change/add request.
- `[ADM-112]` When admin responds to a request, the client receives a push/email notification with the outcome and any notes.

**Business Rules:**
- Clients cannot directly modify the appointment; all changes require admin approval.
- The system enforces the 15-minute buffer when admin reviews a request.
- Decline and counter-proposal both notify the client immediately.

---

#### 3.4 Service Request (Additional / À La Carte)
**User Stories:**
- `[CLT-120]` As a client, I can request an additional à la carte service from a predefined service menu:
  - Extended time visit ($30/30 min)
  - Weekend/holiday visit – 30 min ($55) or 60 min ($65)
  - Additional weekly visit – 30 min ($40) or 60 min ($50)
  - Staff-home boarding ($110/24 hr)
  - In-home pet/house sitting ($110/24 hr)
- `[CLT-121]` When requesting, I can select preferred dog(s), service type, date, time block, and add a note.
- `[CLT-122]` I am shown a price estimate for the requested service before submitting.
- `[ADM-120]` As admin, service requests appear as a badge/notification in the admin dashboard.
- `[ADM-121]` As admin, I can approve (which creates the appointment and invoice), decline with a note, or counter-propose a different time.

---

#### 3.5 Membership Pause
**User Stories:**
- `[CLT-130]` As a client, I can request a membership pause of 1–4 weeks total per year (in 1-week increments).
- `[ADM-130]` As admin, I receive a notification of a pause request.
- `[ADM-131]` As admin, I can approve or deny a pause request; approval auto-adjusts the next billing date and credits the pro-rated amount.

**Business Rules:**
- Maximum of 4 pause weeks per calendar year.
- Pause requests require at minimum 1 week advance notice to receive the credit in the current month; less notice credits the following month.
- The system tracks how many pause weeks have been used per client per calendar year.

---

### MODULE 4: Visit Lifecycle & Notifications

This module describes the full notification flow for each visit. All notifications appear in the client's **Conversation thread** (see Module 5) and also fire as push notifications.

#### 4.1 Pre-Visit Prompt (Day Before)
**Trigger:** Automated — fires at 8:00 AM the day before a scheduled appointment.

**User Stories:**
- `[NOT-001]` The client receives a push notification: *"Tomorrow's visit is coming up! Anything special you'd like for [Dog's name]?"*
- `[NOT-002]` The notification links to the Conversation thread where the client sees a structured message with quick-reply buttons:
  - ☐ Trim nails
  - ☐ Extra brushing
  - ☐ Focus on enrichment sniffing
  - ☐ Skip the post-walk refresh today
  - ☐ Please feed [dog]
  - ☐ Administer medication
  - ☐ Other (free text field)
- `[NOT-003]` Client can select multiple options; their selections are saved to the appointment's `special_requests` field.
- `[ADM-200]` Admin sees the client's selections highlighted on the appointment detail card in the calendar.

**Business Rules:**
- If the client does not respond by 7:00 AM on the day of the visit, the appointment proceeds with no special requests and admin is not blocked.
- Quick-reply options can be edited by admin from a settings screen.
- If no appointments are tomorrow, the notification does not fire.

---

#### 4.2 Arrival Notification
**Trigger:** Admin manually taps "Check In" in the admin app when arriving at the client's home.

**User Stories:**
- `[NOT-010]` When admin checks in, the client immediately receives a push notification and in-thread message: *"Sophie has arrived for [Dog's name]'s walk! 🐾"*
- `[NOT-011]` The check-in time is recorded on the VisitReport.

---

#### 4.3 Visit Completion Notification & Report Card
**Trigger:** Admin manually taps "Complete Visit" in the admin app.

**User Stories:**
- `[NOT-020]` Client receives a push notification: *"[Dog's name]'s visit is complete! Here's today's report 🐾"*
- `[NOT-021]` The in-thread message includes:
  - One or more photos (admin uploads during/after visit)
  - Visit stats: duration, approximate route summary if GPS enabled
  - Report card: peed ✓/✗, pooped ✓/✗, ate ✓/✗, drank ✓/✗
  - Mood emoji (1–5 scale mapped to emoji: 😴😐🙂😄🤩)
  - Free-text notes from admin
  - Quick-reply prompt: *"Anything to share or request for next time? Reply below or tap a quick response:"*
    - 👍 Looks great, thanks!
    - 💬 I have a note (opens text input)
    - 📅 Can we adjust something? (links to service request)
- `[NOT-022]` Client can reply freely to the report thread at any time after.
- `[ADM-210]` Admin can see if/when the client has read the report (read receipts).

**Business Rules:**
- At least 1 photo is required before admin can mark a visit as complete.
- Report card data (peed, pooped, ate, drank) is optional but encouraged.
- Visit duration is auto-calculated from check-in to check-out timestamps.

---

#### 4.4 Admin Broadcast Notifications
**User Stories:**
- `[ADM-220]` As admin, I can compose and send a push notification + in-app message to:
  - All active clients
  - A specific client
  - A custom selection of clients (multi-select)
- `[ADM-221]` Admin can choose delivery channels: push notification only, in-thread message only, or both.
- `[ADM-222]` Broadcast messages appear in each client's general conversation thread (not linked to an appointment).
- `[ADM-223]` Admin can schedule broadcasts for a future date/time.

**Example Broadcasts:**
- *"Thanks for a great month! Is there anything you'd like to see more or less of next month?"*
- *"Holiday availability reminder: I'm taking Dec 24–26 off. Please submit requests early!"*
- *"New service available: Weekend group hikes! Reply to learn more."*

---

### MODULE 5: Messaging & Conversations

#### 5.1 Conversation Threads
**User Stories:**
- `[MSG-001]` Each client has a primary conversation thread with admin for general ad hoc messaging.
- `[MSG-002]` Each completed visit generates an in-thread visit report card message that is part of the same conversation thread (not a separate thread).
- `[MSG-003]` Pre-visit prompts, arrival notifications, and report cards all appear in chronological order in the single conversation thread.
- `[MSG-004]` As a client, I can send a free-text message to admin at any time from the conversation thread.
- `[MSG-005]` As admin, I can send a message to any client from within their conversation thread.
- `[MSG-006]` As admin, I see all client conversations in a unified inbox view, sorted by most recent activity.
- `[MSG-007]` Unread messages display a badge count on the inbox icon in the admin dashboard and on the messages tab in the client app.
- `[MSG-008]` Both admin and client can attach photos to messages.
- `[MSG-009]` Read receipts are shown (grey = delivered, blue = read).
- `[MSG-010]` As admin, I can mark a conversation as "resolved" or "needs follow-up."

**Business Rules:**
- There is one conversation per client (not per appointment). Visit reports are messages within that thread.
- Clients cannot initiate a new/separate thread — all communication is in the single thread.
- Admin can delete their own sent messages within 5 minutes of sending.
- Message history is retained indefinitely.

---

### MODULE 6: Billing & Payments

#### 6.1 Subscription Billing

**Pricing Tiers:**
```
essential_60:   $485 CAD/month  (2 walks/week, min. 60 min)
signature_60:   $695 CAD/month  (3 walks/week, min. 60 min)
premier_60:   $1,125 CAD/month  (5 walks/week, 60-90 min, priority scheduling)
essential_30:   $355 CAD/month  (2 walks/week, min. 30 min)
signature_30:   $525 CAD/month  (3 walks/week, min. 30 min)
premier_30:     $825 CAD/month  (5 walks/week, 30 min)
```

**User Stories:**
- `[BIL-001]` As admin, I can assign a subscription tier to a client with a specific start date (does not need to be the 1st of the month).
- `[BIL-002]` Subscription invoices are auto-generated on the client's billing anniversary date each month (e.g., if they started Aug 4, invoice generates on Sep 4, Oct 4, etc.).
- `[BIL-003]` As admin, I can enroll a client in Stripe ACH (bank transfer) or credit card.
- `[BIL-004]` Credit card payments automatically apply a 2.9% surcharge, which is shown as a separate line item on the invoice.
- `[BIL-005]` As admin, I can manually mark an invoice as paid (for eTransfer payments) and record the payment method.
- `[BIL-006]` As a client, I can view all past and current invoices from the billing section of my profile.
- `[BIL-007]` As a client, I can pay an outstanding invoice from the app using my saved payment method.
- `[BIL-008]` As a client, when paying an invoice, I am offered the option to add a tip (dollar amount or % presets: 10%, 15%, 20%, custom).
- `[BIL-009]` As admin, I can view all invoices across all clients in a billing dashboard with filters (status, date range, client).
- `[BIL-010]` As admin, I can download invoice PDFs for any client.

**Business Rules:**
- GST (5%) is calculated and shown as a separate line item on all invoices.
- Credit card surcharge (2.9%) applies to the subtotal + GST.
- Tips are not subject to GST surcharge.
- eTransfer payments are not subject to the 2.9% surcharge.
- Stripe integration: use Stripe Billing for subscription invoices; Stripe Payment Intents for one-time charges.
- Lockbox deposit ($50 CAD) is a separate one-time invoice type.

**Stripe Webhook Events to Handle:**
```
invoice.payment_succeeded     → mark invoice paid, notify client
invoice.payment_failed        → notify admin + client, retry logic
customer.subscription.updated → sync tier changes
payment_intent.succeeded      → mark additional service invoice paid
```

---

#### 6.2 Additional Service Billing
**User Stories:**
- `[BIL-020]` As admin, I can create a manual invoice for any additional service at any time.
- `[BIL-021]` Additional service invoices are generated immediately upon admin approval of a service request.
- `[BIL-022]` As a client, I receive a push notification when a new invoice is issued.
- `[BIL-023]` As a client, I can pay additional service invoices immediately from the notification or billing tab.

**Business Rules:**
- Additional service invoices are separate from the subscription invoice.
- Admin can bundle multiple additional services into one invoice if they occur in the same billing cycle.
- If admin manually adds an à la carte service to a scheduled visit, the system auto-generates a draft invoice for admin review before sending.

---

#### 6.3 Invoice Line Item Reference
```
Subscription (Essential Club - 60 min):  $485.00
Subscription (Signature Club - 60 min):  $695.00
Subscription (Premier Club - 60 min):   $1,125.00
Extended time visit (30 min):              $30.00
Weekend/holiday visit (30 min):            $55.00
Weekend/holiday visit (60 min):            $65.00
Additional weekly visit (30 min):          $40.00
Additional weekly visit (60 min):          $50.00
Staff-home boarding (per 24 hr):          $110.00
In-home pet/house sitting (per 24 hr):    $110.00
Lockbox deposit (one-time):                $50.00
Credit card surcharge:                      2.9%
GST:                                         5%
Tip:                                  client-defined
```

---

### MODULE 7: Admin Dashboard

**User Stories:**
- `[DASH-001]` As admin, the home screen of the dashboard shows:
  - Today's appointments (chronological, with client/dog names and time)
  - Pending service requests (count + list)
  - Unread messages (count)
  - Outstanding invoices (count + total value)
  - Upcoming subscription renewals (next 7 days)
- `[DASH-002]` As admin, I can access quick-action buttons: "Start Visit", "Send Message", "Create Invoice", "New Service Request Response."
- `[DASH-003]` As admin, I can see a "Today's Walk Card" for each appointment: client address, dog(s), special requests, and a one-tap "Check In" button.
- `[DASH-004]` As admin, I can access a client list with search and filter (by name, status, subscription tier).
- `[DASH-005]` As admin, I can see a simple revenue summary: current month billed, collected, and outstanding.

---

### MODULE 8: Onboarding Flow (Client)

When a client first logs in via their invitation link:

**Step 1:** Set password
**Step 2:** Welcome screen ("You're in! Here's how this works.")
**Step 3:** Review pre-filled profile from intake form (or prompt to complete if not done)
**Step 4:** Confirm home access details
**Step 5:** Review dog profile(s)
**Step 6:** Add payment method (Stripe — ACH or card)
**Step 7:** Review and sign service agreement (if not completed via intake form)
**Step 8:** Confirmation screen with upcoming appointment(s) shown

**User Stories:**
- `[ONB-001]` As a new client, I am walked through a step-by-step onboarding flow on first login.
- `[ONB-002]` I can skip steps and return to complete them later, except for service agreement (required) and payment method (required before first billing date).
- `[ONB-003]` As admin, I can see which onboarding steps each client has completed.

---

## 4. API Route Reference (Summary)

```
# Auth
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/set-password          (first login)
GET    /api/auth/me

# Admin — Clients
GET    /api/admin/clients              (list, search, filter)
POST   /api/admin/clients             (create)
GET    /api/admin/clients/:id
PATCH  /api/admin/clients/:id
POST   /api/admin/clients/invite
POST   /api/admin/clients/:id/resend-invite
POST   /api/admin/clients/:id/reset-password

# Admin — Dogs
GET    /api/admin/dogs                 (all dogs, filterable)
POST   /api/admin/dogs
GET    /api/admin/dogs/:id
PATCH  /api/admin/dogs/:id

# Client — Profile
GET    /api/client/profile
PATCH  /api/client/profile
GET    /api/client/dogs
POST   /api/client/dogs               (triggers admin notification)
PATCH  /api/client/dogs/:id

# Home Access (admin-only read/write; client can update)
GET    /api/admin/clients/:id/home-access
PATCH  /api/admin/clients/:id/home-access
GET    /api/client/home-access
PATCH  /api/client/home-access        (triggers admin notification)

# Appointments
GET    /api/admin/appointments         (all; filterable by date, client)
POST   /api/admin/appointments
GET    /api/admin/appointments/:id
PATCH  /api/admin/appointments/:id
DELETE /api/admin/appointments/:id
POST   /api/admin/appointments/:id/check-in
POST   /api/admin/appointments/:id/complete
GET    /api/client/appointments        (own upcoming + past)

# Service Requests
GET    /api/admin/service-requests     (all pending)
PATCH  /api/admin/service-requests/:id (approve / decline / counter)
POST   /api/client/service-requests
GET    /api/client/service-requests

# Messaging
GET    /api/conversations/:clientId    (full thread)
POST   /api/conversations/:clientId/messages
PATCH  /api/conversations/:clientId/messages/:messageId/read

# Notifications
POST   /api/admin/notifications/broadcast
GET    /api/admin/notifications/history

# Invoices
GET    /api/admin/invoices             (all)
POST   /api/admin/invoices            (manual create)
GET    /api/admin/invoices/:id
PATCH  /api/admin/invoices/:id
POST   /api/admin/invoices/:id/mark-paid
GET    /api/client/invoices
POST   /api/client/invoices/:id/pay
POST   /api/client/invoices/:id/tip

# Documents
GET    /api/admin/clients/:id/documents
POST   /api/admin/clients/:id/documents
DELETE /api/admin/clients/:id/documents/:docId
GET    /api/client/documents
POST   /api/client/documents          (upload)

# Stripe Webhooks
POST   /api/webhooks/stripe

# Intake Form
GET    /api/intake/:token              (public — pre-filled if admin created profile)
POST   /api/intake/:token/submit
```

---

## 5. Notification Triggers Reference

| Event | Recipient | Channel | Timing |
|---|---|---|---|
| Invitation sent | Client | Email | Immediate |
| Pre-visit prompt | Client | Push + In-thread | 8:00 AM day before |
| Admin arrives (check-in) | Client | Push + In-thread | Immediate |
| Visit complete + report | Client | Push + In-thread | Immediate on complete |
| Profile updated by client | Admin | In-app + Email | Immediate |
| Dog profile updated by client | Admin | In-app + Email | Immediate |
| New dog added by client | Admin | In-app + Push | Immediate |
| Home access updated by client | Admin | In-app + Push | Immediate |
| Service request submitted | Admin | In-app + Push | Immediate |
| Service request approved/declined | Client | Push + In-thread | Immediate |
| New invoice issued | Client | Push + Email | Immediate |
| Invoice payment failed | Admin + Client | Push + Email | Immediate |
| Subscription renewal upcoming | Client | Email | 3 days before |
| Message received | Recipient | Push | Immediate |
| Broadcast message sent | Selected clients | Push + In-thread | Scheduled or immediate |
| Document uploaded by client | Admin | In-app | Immediate |
| Onboarding step completed | Admin | In-app | Immediate |

---

## 6. Permission Matrix

| Feature | Admin | Client |
|---|---|---|
| View own profile | ✓ | ✓ |
| Edit own profile | ✓ | ✓ (triggers notification) |
| View any client profile | ✓ | ✗ |
| Edit any client profile | ✓ | ✗ |
| View admin notes | ✓ | ✗ |
| View exact appointment time | ✓ | ✗ (sees 3-hr block only) |
| Create/edit appointments | ✓ | ✗ (can request only) |
| Approve service requests | ✓ | ✗ |
| Create invoices | ✓ | ✗ |
| Mark invoice paid (manual) | ✓ | ✗ |
| Pay own invoice | ✗ | ✓ |
| View all client invoices | ✓ | ✗ |
| Send broadcast notification | ✓ | ✗ |
| View home access codes | ✓ | ✓ (own only) |
| Check in / check out | ✓ | ✗ |
| Submit visit report | ✓ | ✗ |
| Add dog to profile | ✓ | ✓ (pending review) |
| View all conversations | ✓ | ✗ (own only) |

---

## 7. UI Screens Reference

### Admin Web & Mobile
```
/admin
  /dashboard                  — today's schedule, alerts, quick actions
  /calendar                   — full calendar; day/week/month
  /clients                    — client list
  /clients/:id                — client profile
  /clients/:id/dogs           — dog profiles
  /clients/:id/documents      — documents
  /clients/:id/billing        — invoices & subscription
  /clients/:id/messages       — conversation thread
  /dogs/:id                   — individual dog profile
  /service-requests           — pending requests queue
  /billing                    — all invoices, billing dashboard
  /messages                   — unified inbox
  /notifications              — broadcast tool & history
  /settings                   — quick-reply options, notification config
```

### Client Web & Mobile
```
/portal
  /home                       — upcoming appointments, recent report
  /appointments               — appointment list + calendar view
  /messages                   — conversation thread with admin
  /profile                    — personal info, home access
  /pets                       — dog profiles
  /billing                    — invoices & payment methods
  /documents                  — shared docs
```

---

## 8. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Mobile platforms | iOS 15+ and Android 11+ |
| Web browser support | Chrome, Safari, Firefox — last 2 versions |
| API response time | < 300ms p95 for all read endpoints |
| Image upload | Max 10 MB; auto-compress to < 1 MB for in-chat delivery |
| Offline mode (mobile) | Cache last 7 days of conversations and upcoming appointments |
| Security | HTTPS everywhere; JWT auth with 15-min access token + 7-day refresh token; all sensitive fields encrypted at rest |
| WCAG | AA compliance minimum |
| Data location | Canadian data residency preferred (Supabase offers Toronto region) |
| Timezone | All times stored UTC; displayed in `America/Vancouver` |

---

## 9. Future Scope (Not in v1)

- GPS route sharing with clients (Tractive integration or native GPS)
- Group hike sign-up and management
- Referral program tracking (50% off first month for both parties)
- Quickbooks sync for accounting
- Dropshipping / merch store
- Subcontractor / staff management (multiple walkers)
- Waitlist management for prospective clients
- Anniversary gift reminders (1-week Polaroid, 1-month welcome box, 1-year gift)
- Client-facing analytics ("Your dog walked 12 km this month!")
