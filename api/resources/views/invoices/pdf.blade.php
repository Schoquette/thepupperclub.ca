<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @font-face {
      font-family: 'Lato';
      font-style: normal;
      font-weight: 400;
      src: url('{{ $fontsDir }}/Lato-Regular.ttf') format('truetype');
    }
    @font-face {
      font-family: 'Lato';
      font-style: normal;
      font-weight: 700;
      src: url('{{ $fontsDir }}/Lato-Bold.ttf') format('truetype');
    }
    @font-face {
      font-family: 'Playfair Display SC';
      font-style: normal;
      font-weight: 400;
      src: url('{{ $fontsDir }}/PlayfairDisplaySC-Regular.ttf') format('truetype');
    }
    @font-face {
      font-family: 'Playfair Display SC';
      font-style: normal;
      font-weight: 700;
      src: url('{{ $fontsDir }}/PlayfairDisplaySC-Bold.ttf') format('truetype');
    }

    body { font-family: 'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #3B2F2A; font-size: 13px; margin: 0; padding: 0; letter-spacing: 0; }
    .page { padding: 0; }

    /* Branded header */
    .header-bar { background: #F6F3EE; padding: 20px 32px; color: #3B2F2A; }
    .header-bar table { width: 100%; }
    .header-bar td { vertical-align: middle; }
    .invoice-label { font-family: 'Playfair Display SC', serif; font-size: 14px; letter-spacing: 0.05em; color: #3B2F2A; text-align: right; font-weight: 400; }
    .invoice-meta { font-size: 11px; color: rgba(59,47,42,0.7); text-align: right; margin-top: 4px; line-height: 1.7; }

    /* Gold accent */
    .gold-bar { height: 4px; background: #C9A24D; }

    .content { padding: 28px 32px 36px; }

    /* Status badge */
    .status-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .status-paid { background: #d4edda; color: #155724; }
    .status-sent { background: #fff3cd; color: #856404; }
    .status-overdue { background: #f8d7da; color: #721c24; }
    .status-draft { background: #e2e8f0; color: #475569; }
    .status-approved { background: #e2e8f0; color: #475569; }
    .status-void { background: #f1f1f1; color: #888; }

    /* Parties (From / Bill To) */
    .parties { margin-bottom: 28px; }
    .parties table { width: 100%; }
    .parties td { vertical-align: top; width: 50%; padding-right: 20px; }
    .party-label { font-family: 'Lato', sans-serif; color: #C9A24D; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin: 0 0 8px; }
    .party-name { font-size: 13px; font-weight: 700; margin: 2px 0; line-height: 1.5; }
    .party-detail { font-size: 13px; color: #C8BFB6; margin: 2px 0; line-height: 1.5; }

    /* Dates row */
    .dates-row { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #F6F3EE; }
    .dates-row table { width: 100%; }
    .dates-row td { font-size: 13px; vertical-align: top; }
    .dates-label { color: #C8BFB6; margin-right: 4px; }
    .dates-value { color: #3B2F2A; font-weight: 600; }
    .paid-text { color: #155724; font-weight: 700; margin-top: 4px; }

    /* Line items table */
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .items-table thead tr { background: #F6F3EE; }
    .items-table thead th { font-family: 'Lato', sans-serif; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #3B2F2A; }
    .items-table tbody tr { border-bottom: 1px solid #F6F3EE; }
    .items-table tbody tr.alt { background: rgba(246,243,238,0.5); }
    .items-table tbody td { padding: 10px 12px; font-size: 13px; }
    .td-muted { color: #C8BFB6; }
    .td-bold { font-weight: 400; color: #3B2F2A; }
    .no-gst { display: inline-block; margin-left: 6px; font-size: 9px; color: #C8BFB6; border: 1px solid #C8BFB6; border-radius: 3px; padding: 1px 4px; vertical-align: middle; }

    /* Totals */
    .totals { margin-left: auto; width: 288px; }
    .totals table { width: 100%; }
    .totals td { font-size: 13px; padding: 3px 0; }
    .totals td.t-label { color: #C8BFB6; }
    .totals td.t-amount { text-align: right; color: #3B2F2A; }
    .total-grand { border-top: 2px solid #C9A24D; margin-top: 8px; padding-top: 10px; }
    .total-grand table { width: 100%; }
    .total-grand td { font-size: 15px; font-weight: 700; color: #3B2F2A; padding: 0; }
    .total-grand td.t-amount { text-align: right; }

    /* Payment method box */
    .payment-box { margin-top: 28px; padding: 14px 16px; background: #F6F3EE; border-radius: 6px; border: 1px solid rgba(200,191,182,0.3); }
    .payment-title { margin: 0 0 6px; font-weight: 700; color: #3B2F2A; font-size: 13px; }
    .payment-detail { margin: 0; font-size: 12px; color: #7a6560; }

    /* Notes */
    .notes { margin-top: 16px; color: #888; font-size: 12px; }

    /* Footer */
    .footer { margin-top: 36px; text-align: center; color: #C8BFB6; font-size: 11px; border-top: 1px solid #F6F3EE; padding-top: 16px; }

    /* Void watermark */
    .void-watermark {
      position: fixed;
      top: 35%;
      left: 15%;
      font-size: 120px;
      font-weight: 900;
      color: rgba(200, 191, 182, 0.15);
      letter-spacing: 20px;
      transform: rotate(-30deg);
      z-index: 10;
      pointer-events: none;
    }
  </style>
</head>
<body>
<div class="page">
  @if($invoice->status === 'void')
  <div class="void-watermark">VOID</div>
  @endif

  {{-- Branded header --}}
  <div class="header-bar">
    <table>
      <tr>
        <td>
          @if(isset($logoPath) && file_exists($logoPath))
            <img src="{{ $logoPath }}" alt="The Pupper Club" style="height: 48px;" />
          @else
            <div style="font-size: 20px; letter-spacing: 2px; font-weight: bold; color: #3B2F2A;">THE PUPPER CLUB</div>
            <div style="font-size: 11px; color: rgba(59,47,42,0.6); margin-top: 4px;">Curated Dog Care</div>
          @endif
        </td>
        <td style="text-align: right;">
          <div class="invoice-label">INVOICE</div>
          <div class="invoice-meta">
            {{ $invoice->invoice_number }}<br>
            {{ $invoice->created_at->format('F j, Y') }}
          </div>
        </td>
      </tr>
    </table>
  </div>
  <div class="gold-bar"></div>

  <div class="content">
    {{-- Status badge --}}
    <div style="margin-bottom: 20px;">
      <span class="status-badge status-{{ $invoice->status }}">{{ ucfirst($invoice->status) }}</span>
    </div>

    {{-- From / Bill To --}}
    <div class="parties">
      <table>
        <tr>
          <td>
            <div class="party-label">From</div>
            <p class="party-name">The Pupper Club</p>
            <p class="party-detail">Sophie Choquette</p>
            <p class="party-detail">Port Moody, BC</p>
            <p class="party-detail">sophie@thepupperclub.ca</p>
          </td>
          <td>
            <div class="party-label">Bill To</div>
            <p class="party-name">{{ $invoice->user->name }}</p>
            <p class="party-detail">{{ $invoice->user->email }}</p>
            @if($invoice->user->clientProfile?->address)
            <p class="party-detail">{{ $invoice->user->clientProfile->address }}</p>
            <p class="party-detail">{{ implode(', ', array_filter([$invoice->user->clientProfile->city, $invoice->user->clientProfile->province, $invoice->user->clientProfile->postal_code])) }}</p>
            @endif
          </td>
        </tr>
      </table>
    </div>

    {{-- Dates row --}}
    <div class="dates-row">
      <table>
        <tr>
          <td>
            @if($invoice->billing_period_start && $invoice->billing_period_end)
            <span class="dates-label">Service period:</span>
            <span class="dates-value"> {{ $invoice->billing_period_start->format('F j, Y') }} – {{ $invoice->billing_period_end->format('F j, Y') }}</span>
            @endif
          </td>
          <td style="text-align: right;">
            @if($invoice->due_date)
            <span class="dates-label">Due:</span>
            <span class="dates-value"> {{ $invoice->due_date->format('F j, Y') }}</span>
            @endif
            @if($invoice->paid_at)
            <div class="paid-text">Paid {{ $invoice->paid_at->format('F j, Y') }}</div>
            @endif
          </td>
        </tr>
      </table>
    </div>

    {{-- Line items --}}
    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Date</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        @foreach($invoice->lineItems as $i => $item)
        <tr class="{{ $i % 2 === 1 ? 'alt' : '' }}">
          <td>
            {{ $item->description }}
            @if($item->gst_exempt)
            <span class="no-gst">No GST</span>
            @endif
          </td>
          <td class="td-muted">{{ $item->service_date?->format('M j, Y') ?? '—' }}</td>
          <td class="td-muted" style="text-align:center">{{ rtrim(rtrim(number_format((float)$item->quantity, 2, '.', ''), '0'), '.') }}</td>
          <td class="td-muted" style="text-align:right">${{ number_format($item->unit_price, 2) }}</td>
          <td class="td-bold" style="text-align:right">${{ number_format($item->total, 2) }}</td>
        </tr>
        @endforeach
      </tbody>
    </table>

    {{-- Totals --}}
    @php
      $displaySubtotal = $invoice->subtotal > 0 ? $invoice->subtotal : $invoice->lineItems->sum('total');
      $displayGst = $invoice->gst !== null ? $invoice->gst : round($displaySubtotal * 0.05, 2);
    @endphp
    <div class="totals">
      <table>
        <tr>
          <td class="t-label">Subtotal</td>
          <td class="t-amount">${{ number_format($displaySubtotal, 2) }}</td>
        </tr>
        @if($displayGst > 0)
        <tr>
          <td class="t-label">GST (5%)</td>
          <td class="t-amount">${{ number_format($displayGst, 2) }}</td>
        </tr>
        @endif
        @if($invoice->credit_card_surcharge > 0)
        <tr>
          <td class="t-label">CC Surcharge (2%)</td>
          <td class="t-amount">${{ number_format($invoice->credit_card_surcharge, 2) }}</td>
        </tr>
        @endif
        @if($invoice->tip > 0)
        <tr>
          <td class="t-label">Tip</td>
          <td class="t-amount">${{ number_format($invoice->tip, 2) }}</td>
        </tr>
        @endif
      </table>
      <div class="total-grand">
        <table>
          <tr>
            <td>Total (CAD)</td>
            <td class="t-amount">${{ number_format($invoice->total, 2) }}</td>
          </tr>
        </table>
      </div>
    </div>

    {{-- Payment terms --}}
    @php
      $billingMethod = $invoice->billing_method ?? $invoice->user->clientProfile?->billing_method;
      $methodLabel = match($billingMethod) {
        'credit_card' => 'Credit Card',
        'e_transfer' => 'E-Transfer',
        'cash' => 'Cash',
        default => $billingMethod ? ucwords(str_replace('_', ' ', $billingMethod)) : null,
      };
    @endphp
    @if($methodLabel && $invoice->status !== 'void')
    <div class="payment-box">
      <p class="payment-title">Payment Terms &mdash; {{ $methodLabel }}</p>
      @if($billingMethod === 'credit_card')
      <p class="payment-detail">Charged automatically to card on file. A 2% credit card surcharge is applied.</p>
      @elseif($billingMethod === 'e_transfer')
      <p class="payment-detail">Please send your e-Transfer to <strong>sophie@thepupperclub.ca</strong> before the due date.</p>
      @elseif($billingMethod === 'cash')
      <p class="payment-detail">Cash or cheque can be left at your service address on the first visit of your service period.</p>
      @endif
    </div>
    @endif

    @if($invoice->notes)
    <p class="notes"><strong>Notes:</strong> {{ $invoice->notes }}</p>
    @endif

    <div class="footer">
      <p>Thank you for choosing The Pupper Club!</p>
      <p>sophie@thepupperclub.ca &middot; Port Moody, BC &middot; thepupperclub.ca</p>
    </div>
  </div>
</div>
</body>
</html>
