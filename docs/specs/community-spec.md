# The Pupper Club — Community

**A trusted neighbourhood network for shared pet care.**

*Product Specification & Brand Brief — Desktop Application*

---

## Overview

The Pupper Club Community is a desktop application that connects neighbours within walking distance of one another to share occasional pet care — informally, freely, and with care. It is the community arm of The Pupper Club, extending the brand's curated care philosophy beyond the professional service and into the everyday rhythms of neighbourhood life.

This isn't a marketplace. There is no money exchanged, no transactional layer, no rating system that turns neighbours into vendors. It is a quiet, considered platform for building a small, trusted network of people nearby — pet owners and pet lovers alike — who can step in for one another when life happens.

---

## Brand Alignment

The Community sits within The Pupper Club brand family and inherits its visual and verbal identity in full. Where the core service is *curated dog care*, the Community is *curated neighbourhood care* — same considered tone, same premium restraint, same emphasis on intentionality.

**Parent brand:** The Pupper Club ([thepupperclub.ca](https://www.thepupperclub.ca))
**Sub-brand name:** The Pupper Club Community
**Wordmark treatment:** "Community" set in Alleron, all caps, generous tracking, positioned beneath the primary wordmark or as a horizontal lockup.

**Community brand statement:**
> "This isn't a pet-sitting marketplace. It's a small, trusted circle of neighbours who show up for each other — and for the dogs they love."

---

## Core Concept

A user joins the Community, completes verification, and is shown other verified members within a defined radius (typically under 1km). They can connect with people they choose, build a personal network over time, and — when they need help — quietly broadcast a request to selected members of that network.

The platform does three things, and only three things:

1. **Verifies** that members are who they say they are, and live where they say they live.
2. **Connects** members with nearby neighbours through a privacy-first matching system.
3. **Coordinates** care requests through a messaging layer that respects the privacy of all parties.

Everything else is intentionally out of scope.

---

## Who It's For

The Community is built for two overlapping groups:

- **Pet owners** who occasionally need someone to feed the cat, let the dog out, or check in on a pet during a long workday or short trip.
- **Animal lovers without pets** — retirees, people working from home, students, anyone with time and affection to share — who would welcome a dog walk or a cat visit as part of their day.

The platform does not require that a member own a pet. It requires only that they pass verification and participate in the spirit of the community.

---

## Key Features

### 1. Identity Verification

Every member completes a verification step before they can see or be seen by other members.

- Upload of a valid government-issued ID showing **name and address**.
- A live selfie photo, matched against the ID photo via automated comparison with human review for edge cases.
- Address verification ties the account to a specific neighbourhood radius — without ever exposing the address to other users.
- Verification badges are visible on member profiles. Unverified accounts cannot send messages, broadcast requests, or appear in proximity searches.

### 2. Location-Based Matching

Members are matched based on proximity, with a default radius of under 1km. This radius is configurable by the user (e.g., same building, 500m, 1km, 2km).

- Addresses are **never displayed** to other users — not as text, not on a map, not in any export.
- Distance is shown approximately ("Less than 500m away," "In your building," "Within 1km") rather than precisely.
- Members in the same building are flagged with a soft indicator, not a unit number.

### 3. Profile & Discovery

A profile is intentionally minimal. The platform resists the social-media pull toward over-disclosure.

- First name and last initial.
- Verification status.
- Approximate distance.
- A short self-written introduction (optional).
- The pets in the household, if any, with names and a sentence or two each.
- Availability preferences (mornings, evenings, weekends, ad hoc).

Browsing is opt-in on both sides. A member can request to connect; the other can accept, decline, or ignore without notification.

### 4. Network Building

A member's connections form their personal Community network. The network is private — visible only to the member who built it. Connections can be removed at any time, silently.

### 5. Care Broadcasts

When a member needs help, they compose a broadcast request and select which members of their network should receive it.

- The request includes: the type of care needed, the timing, the duration, and any context the member wants to share.
- Recipients see only their own copy of the message. They do not see who else received it, and they cannot see who has or hasn't responded.
- Each recipient can **confirm availability**, **decline**, or simply not respond.
- The sender sees responses as they come in and can close the broadcast once the need is met.
- A confirmed match opens a private one-to-one conversation between the two members.

This design protects everyone — the requester from looking desperate, the responders from social pressure, and the neighbourhood dynamic from any sense of competition or obligation.

### 6. Secure Messaging

All communication happens within the platform. There is no SMS handoff, no email exchange, no phone numbers shared by default.

- End-to-end encryption for one-to-one conversations.
- Message retention is user-controlled, with sensible defaults.
- A persistent reminder, gently shown the first time two members meet through the platform: *"For first meetings, we recommend somewhere public — a park, a café, the lobby of your building."*
- Members can share photos within the chat (helpful for confirming "I'm here, the cat is fed, here she is on the windowsill").

### 7. Blocking & Reporting

- Any member can block any other member at any time. Blocks are silent and immediate. The blocked member cannot see, message, or be matched with the blocker again.
- A reporting flow exists for safety concerns, with categories that prioritize clarity over jargon.
- Reports are reviewed by a small, trained moderation team within a defined SLA. Repeat reports trigger account review.

### 8. Recommendations

Members can leave brief, written recommendations for neighbours they've shared care with — a kind word, a small note, an acknowledgement. The feature exists to build trust within the network, not to create a marketplace reputation. Think of it as a written reference, not a review.

A few rules shape the design:

- **Positive only.** There is no negative review, no thumbs down, no critical commentary surface. The platform offers one direction of feedback in public, and it is kindness. Safety concerns flow through the reporting system, which is private and separate.
- **Written, never numerical.** Recommendations are short text — up to roughly 280 characters — and are never aggregated into a star rating, score, or average. There is no leaderboard.
- **Specific over generic.** A gentle prompt encourages members to write about a particular moment ("Sat with our cat the weekend we were away — sent a photo every evening") rather than empty praise ("Lovely person, would recommend").
- **Authored, not anonymous.** Recommendations show the author's first name and last initial, the same as a profile. Anonymity would defeat the trust-building purpose and make the feature gameable.
- **Recipient-controlled.** The recipient can hide any recommendation from their profile at any time, without notification to the author. There is no public "rejected" state.
- **Prompted gently after a confirmed care exchange.** A single, soft prompt appears once the chat is closed: *"Want to leave a recommendation for [Name]?"* No reminders, no streaks, no nudges, no badges for writing more.
- **Visible only within the network surface.** Recommendations are shown on a member's profile to other verified members considering a connection. They are not publicly indexed, not shareable as links, not exportable.
- **Optional, always.** Care given without a recommendation is exactly as valued as care given with one. The platform never sorts, ranks, or prioritizes members by recommendation count, and the count is never displayed prominently — if at all.

This is closer to the spirit of a written reference letter than a marketplace review. It rewards specificity, kindness, and small gestures — and it gives newer members a way to build trust without leaning on the platform to vouch for them.

---

## Privacy & Safety Principles

The Community is built on a few non-negotiable principles. These are not features to be revisited — they are the foundation.

- **Addresses are never shared.** Not in profiles, not in messages (the platform suggests gentle alternatives if a user types one), not in any export.
- **Verification is mandatory before any meaningful interaction.** No browsing other members, no messaging, no broadcasting until verified.
- **No public posts, no feeds, no comments.** The Community is not a social network. There is no surface area for public-facing content, and therefore no harassment vector that resembles one.
- **No ratings, no scores, no negative reviews.** Members may leave positive written recommendations for one another (see *Recommendations* in Key Features), but care is never reduced to a number, and there is no public surface for criticism. Concerns about a member go through the private reporting flow, never the recommendations layer.
- **No money.** The platform has no payment infrastructure, no tipping, no premium tier within Community itself. (The parent service, The Pupper Club, remains a separate paid subscription.)
- **Meet in public the first time.** This is a recommendation, surfaced clearly and repeatedly without being preachy.

---

## User Flows (High-Level)

**Onboarding**
Welcome → ID upload → selfie verification → address verification → profile setup → connection radius selection → first browse.

**Connecting**
Browse nearby members → view profile → send connection request with optional short note → wait for response → connection added to network on acceptance.

**Requesting care**
Compose broadcast → select recipients from network → send → review responses as they arrive → confirm with one responder → opens private chat → close broadcast.

**Offering care**
Receive broadcast → review request → confirm or decline → if confirmed and selected, private chat opens with sender.

**Maintaining the network**
View own network → remove connections silently → adjust radius → adjust availability preferences.

---

## Visual Identity

The Community uses the full Pupper Club visual system, with a few small adjustments to distinguish it from the core service.

| Element | Treatment |
|---|---|
| Wordmark | The Pupper Club stacked logo, with "Community" in Alleron 700, tracked, beneath or beside the wordmark |
| Primary background | Cream `#F6F3EE` |
| Primary text & icons | Espresso `#3B2F2A` |
| Dividers, secondary text | Taupe `#C8BFB6` |
| Community accent | **Just Blue** `#6492D8` — chosen as the Community accent for its association with trust, calm, and connection. Soft Gold is reserved for the core paid service. |
| Display & headings | Playfair Display SC, Regular 400 |
| Body & UI text | Alleron, Light 300 / Regular 400 |
| Labels & system messages | Alleron 700, all caps, wide letter-spacing |

Per the brand guidelines, **Soft Gold and Just Blue never appear together.** The Community ecosystem uses Just Blue as its single accent. The professional service ecosystem uses Soft Gold. This becomes a quiet way to distinguish the two product surfaces.

---

## Verbal Identity

The Community speaks in The Pupper Club voice — calm, considered, warm, never salesy. A few notes specific to this product:

- **Address members as neighbours, not users.** "Your neighbours nearby," "Members of your community."
- **Avoid marketplace language.** No "providers," "sitters," "bookings," "gigs," "jobs."
- **Avoid urgency cues.** No red dots, no "only 2 left," no countdown timers. The platform invites participation; it does not demand it.
- **Be specific.** "Two neighbours within 500m" is more on-brand than "Lots of people nearby."
- **Be kind.** System messages — including refusals, errors, and verification failures — should read as if written by a thoughtful person, not a system.

**Example microcopy:**

> *Empty state:*
> "Your network is quiet right now. When you connect with neighbours nearby, they'll appear here."

> *First-time meeting reminder:*
> "First time meeting in person? We recommend somewhere public — a park, a café, the lobby of your building."

> *Broadcast sent:*
> "Sent to four neighbours. We'll let you know as people respond."

> *Verification pending:*
> "Thanks for your patience. We're reviewing your verification — usually within a day. We'll be in touch as soon as it's done."

> *Recommendation prompt (after a closed care chat):*
> "Want to leave a recommendation for [Name]? A specific moment is more meaningful than a general kind word — and it stays on their profile only if they choose to keep it."

---

## Out of Scope

To keep the platform aligned with its purpose, the following are deliberately excluded:

- Payments, tipping, or any financial transaction between members.
- Public profiles, feeds, posts, comments, or reactions.
- Star ratings, numerical scores, averages, leaderboards, or any form of negative public review.
- Group chats. (One-to-one only, after a confirmed care match.)
- Open marketplaces or ad hoc browsing of strangers outside one's network for non-care purposes.
- Integrations with social platforms.

---

## Technical Notes (Desktop Application)

- **Distribution:** Native desktop application for macOS and Windows. (Linux as a later consideration.)
- **Suggested stack:** Electron or Tauri for cross-platform delivery, with a shared backend API. Tauri is preferred for its smaller footprint and stronger security posture, both of which align with the brand's premium-and-considered positioning.
- **Authentication:** Email plus device-bound credentials. Optional passkey support.
- **Verification provider:** Integrate a third-party identity verification service (Persona, Stripe Identity, Onfido, or similar) for ID-and-selfie matching.
- **Geolocation:** Address-based geocoding done once at verification, stored as a coarse geohash sufficient for radius matching but insufficient to reconstruct the address.
- **Messaging:** End-to-end encrypted, with keys managed per-device. A web fallback (read-only or limited) may be considered post-launch but is not part of v1.
- **Data retention:** Minimal by default. Verification documents are purged after a defined retention window (e.g., 90 days post-verification or upon account closure).

---

## Mission, Vision & Values (Community)

**Vision**
*To make every neighbourhood a little kinder, by helping the people in it look out for one another's pets — and, in small ways, for one another.*

**Mission**
*To build a verified, privacy-first network where neighbours can offer and receive occasional pet care, freely and without obligation.*

**Core values**
1. Trust before reach
2. Privacy as a feature, not a setting
3. Kindness over efficiency
4. Small networks over big ones
5. The dog comes first

---

## Closing Note

The Community is not designed to scale aggressively. It is designed to feel local, small, and warm — the way a good neighbourhood does. Every product decision should ask the same question The Pupper Club asks of itself:

> *Does this feel intentional, unrushed, and tailored?*

If the answer is yes, it belongs. If not, it doesn't.
