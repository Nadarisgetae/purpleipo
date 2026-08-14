export type BiddingStatusState = 'OPEN' | 'CLOSED' | 'UPCOMING' | 'TBA';

export interface BiddingStatusInfo {
  state: BiddingStatusState;
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBg: string;
  cardBorder: string;
  iconColor: string;
  headline: string;
  description: string;
  canBuy: boolean;
  actionAdvice: string;
}

/**
 * Evaluates whether an IPO is currently open for bidding, closed, or starting soon.
 * Combines date window analysis (open/close dates) with SEBI lifecycle stage.
 */
export function getBiddingStatus(
  openDateStr?: string | null,
  closeDateStr?: string | null,
  currentStage?: number
): BiddingStatusInfo {
  const now = new Date();

  let openDate: Date | null = null;
  let closeDate: Date | null = null;

  if (openDateStr && openDateStr !== 'TBD') {
    const parsed = new Date(openDateStr);
    if (!isNaN(parsed.getTime())) {
      openDate = parsed;
      openDate.setHours(0, 0, 0, 0); // Start of open day
    }
  }

  if (closeDateStr && closeDateStr !== 'TBD') {
    const parsed = new Date(closeDateStr);
    if (!isNaN(parsed.getTime())) {
      closeDate = parsed;
      closeDate.setHours(23, 59, 59, 999); // End of close day
    }
  }

  let state: BiddingStatusState = 'TBA';

  // 1. Stage-based hard overrides
  if (currentStage !== undefined && currentStage !== null) {
    if (currentStage >= 9) {
      state = 'CLOSED';
    } else if (currentStage === 8) {
      state = 'OPEN';
    }
  }

  // 2. Date-based refined evaluation (overrides stage if dates are explicit)
  if (openDate || closeDate) {
    if (closeDate && now > closeDate) {
      state = 'CLOSED';
    } else if (openDate && closeDate && now >= openDate && now <= closeDate) {
      state = 'OPEN';
    } else if (openDate && now < openDate) {
      state = 'UPCOMING';
    }
  }

  // 3. Fallback if stage is < 8 and no dates available
  if (state === 'TBA' && currentStage !== undefined && currentStage < 8) {
    state = 'UPCOMING';
  }

  switch (state) {
    case 'OPEN':
      return {
        state: 'OPEN',
        label: 'Open for Bidding',
        shortLabel: 'Open Now',
        badgeBg: 'bg-emerald-500/15',
        badgeText: 'text-emerald-300',
        badgeBorder: 'border-emerald-500/40',
        cardBg: 'from-emerald-950/40 via-slate-900/80 to-slate-950',
        cardBorder: 'border-emerald-500/30',
        iconColor: 'text-emerald-400',
        headline: '🟢 Open for Bidding — Active Buy Window',
        description: 'The public bidding window is LIVE right now! You can place lot bids via your UPI / Broker app before bidding closes.',
        canBuy: true,
        actionAdvice: 'Submit your bid with ASBA/UPI payment mandate before 5:00 PM on closing date.',
      };

    case 'CLOSED':
      return {
        state: 'CLOSED',
        label: 'Closed for Bidding',
        shortLabel: 'Closed',
        badgeBg: 'bg-rose-500/15',
        badgeText: 'text-rose-300',
        badgeBorder: 'border-rose-500/40',
        cardBg: 'from-rose-950/30 via-slate-900/80 to-slate-950',
        cardBorder: 'border-rose-500/30',
        iconColor: 'text-rose-400',
        headline: '🔴 Closed for Bidding — Cannot Place Orders',
        description: 'The bidding window for this IPO has ended. New lot applications are no longer being accepted by exchanges.',
        canBuy: false,
        actionAdvice: 'Bidding closed. Check allotment status on registrar portal or await demat credit.',
      };

    case 'UPCOMING':
      return {
        state: 'UPCOMING',
        label: 'Bidding Will Start Soon',
        shortLabel: 'Starts Soon',
        badgeBg: 'bg-amber-500/15',
        badgeText: 'text-amber-300',
        badgeBorder: 'border-amber-500/40',
        cardBg: 'from-amber-950/30 via-slate-900/80 to-slate-950',
        cardBorder: 'border-amber-500/30',
        iconColor: 'text-amber-400',
        headline: '🟡 Bidding Will Start Soon',
        description: 'Bidding is not open yet. Review the RHP analysis and prepare your UPI handle & funds before the window opens.',
        canBuy: false,
        actionAdvice: 'Prepare your funds and review subscription & anchor data when bidding opens.',
      };

    default:
      return {
        state: 'TBA',
        label: 'Bidding Dates Pending',
        shortLabel: 'Dates TBA',
        badgeBg: 'bg-slate-800/80',
        badgeText: 'text-slate-400',
        badgeBorder: 'border-slate-700',
        cardBg: 'from-slate-900/60 via-slate-900/80 to-slate-950',
        cardBorder: 'border-slate-800',
        iconColor: 'text-slate-400',
        headline: '⚪ Bidding Schedule Pending',
        description: 'Official bidding open and close dates have not been announced by SEBI or Merchant Bankers yet.',
        canBuy: false,
        actionAdvice: 'Check back soon for finalized SEBI offer dates.',
      };
  }
}
