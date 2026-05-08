<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display+SC:wght@400;700&family=Lato:wght@400;700&display=swap');

    body { font-family: 'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #3B2F2A; font-size: 13px; margin: 0; padding: 0; }
    .page { padding: 0; }
    .font-display { font-family: 'Playfair Display SC', serif; }

    /* Branded header */
    .header-bar {
      background: #F6F3EE;
      padding: 28px 40px;
      color: #3B2F2A;
    }
    .header-bar table { width: 100%; }
    .header-bar td { vertical-align: middle; }
    .invoice-label { font-family: 'Playfair Display SC', serif; font-size: 16px; letter-spacing: 3px; color: #3B2F2A; text-align: right; font-weight: 700; }
    .invoice-meta-text { font-size: 12px; color: rgba(59,47,42,0.6); text-align: right; margin-top: 4px; }

    /* Gold accent */
    .gold-bar { height: 4px; background: #C9A24D; }

    .content { padding: 32px 40px 40px; }

    /* Status */
    .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .status-paid { background: #d4edda; color: #155724; }
    .status-sent { background: #fff3cd; color: #856404; }
    .status-overdue { background: #f8d7da; color: #721c24; }
    .status-draft { background: #e2e8f0; color: #475569; }
    .status-void { background: #f1f1f1; color: #888; }

    /* Parties */
    .parties { margin-bottom: 28px; }
    .parties table { width: 100%; }
    .parties td { vertical-align: top; width: 50%; }
    .party-label { font-family: 'Playfair Display SC', serif; color: #C9A24D; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 6px; }
    .party p { margin: 2px 0; line-height: 1.6; font-size: 12px; }

    /* Dates row */
    .dates-row { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e9e4df; }
    .dates-row table { width: 100%; }
    .dates-row td { font-size: 12px; color: #5a4a44; vertical-align: top; }

    /* Line items table */
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .items-table thead tr { background: #F6F3EE; color: #3B2F2A; }
    .items-table thead th { font-family: 'Playfair Display SC', serif; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    .items-table tbody tr { border-bottom: 1px solid #e9e4df; }
    .items-table tbody tr:nth-child(even) { background: #FAFAF8; }
    .items-table tbody td { padding: 10px 12px; font-size: 12px; }

    /* Totals */
    .totals { margin-left: auto; width: 280px; }
    .total-row { padding: 6px 0; border-bottom: 1px solid #e9e4df; }
    .total-row table { width: 100%; }
    .total-row td { font-size: 12px; }
    .total-row.grand { border-top: 3px solid #C9A24D; border-bottom: none; padding-top: 10px; }
    .total-row.grand td { font-family: 'Playfair Display SC', serif; font-size: 15px; font-weight: 700; color: #3B2F2A; }

    /* Payment method box */
    .payment-box { margin-top: 28px; padding: 14px 16px; background: #F6F3EE; border-radius: 6px; border: 1px solid #e9e4df; }

    /* Footer */
    .footer { margin-top: 36px; text-align: center; color: #C8BFB6; font-size: 11px; border-top: 1px solid #e9e4df; padding-top: 16px; }

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

  {{-- Branded header with logo --}}
  <div class="header-bar">
    <table>
      <tr>
        <td>
          @if(isset($logoPath) && file_exists($logoPath))
            <img src="{{ $logoPath }}" alt="The Pupper Club" style="height: 50px;" />
          @else
            <div style="font-size: 22px; letter-spacing: 2px; font-weight: bold; color: #3B2F2A;">THE PUPPER CLUB</div>
            <div style="font-size: 11px; color: rgba(59,47,42,0.6); margin-top: 4px;">Curated Dog Care</div>
          @endif
        </td>
        <td style="text-align: right;">
          <div class="invoice-label">INVOICE</div>
          <div class="invoice-meta-text">
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

    {{-- Parties --}}
    <div class="parties">
      <table>
        <tr>
          <td>
            <div class="party-label">From</div>
            <p><strong>The Pupper Club</strong></p>
            <p>Sophie Choquette</p>
            <p>Port Moody, BC</p>
            <p>sophie@thepupperclub.ca</p>
          </td>
          <td>
            <div class="party-label">Bill To</div>
            <p><strong>{{ $invoice->user->name }}</strong></p>
            <p>{{ $invoice->user->email }}</p>
            @if($invoice->user->clientProfile?->address)
            <p>{{ $invoice->user->clientProfile->address }}</p>
            <p>{{ $invoice->user->clientProfile->city }}, {{ $invoice->user->clientProfile->province }} {{ $invoice->user->clientProfile->postal_code }}</p>
            @endif
          </td>
        </tr>
      </table>
    </div>

    {{-- Dates --}}
    <div class="dates-row">
      <table>
        <tr>
          <td>
            @if($invoice->billing_period_start && $invoice->billing_period_end)
            <strong>Service period:</strong> {{ $invoice->billing_period_start->format('F j, Y') }} - {{ $invoice->billing_period_end->format('F j, Y') }}
            @endif
          </td>
          <td style="text-align: right;">
            @if($invoice->due_date)
            <strong>Due:</strong> {{ $invoice->due_date->format('F j, Y') }}
            @endif
            @if($invoice->paid_at)
            <br><span style="color: #155724; font-weight: bold;">Paid {{ $invoice->paid_at->format('F j, Y') }}</span>
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
        @foreach($invoice->lineItems as $item)
        <tr>
          <td>{{ $item->description }}</td>
          <td>{{ $item->service_date?->format('M j, Y') ?? '—' }}</td>
          <td style="text-align:center">{{ $item->quantity }}</td>
          <td style="text-align:right">${{ number_format($item->unit_price, 2) }}</td>
          <td style="text-align:right">${{ number_format($item->total, 2) }}</td>
        </tr>
        @endforeach
      </tbody>
    </table>

    {{-- Totals --}}
    @php
      $displaySubtotal = $invoice->subtotal > 0 ? $invoice->subtotal : $invoice->lineItems->sum('total');
      $displayGst = $invoice->gst > 0 ? $invoice->gst : round($displaySubtotal * 0.05, 2);
    @endphp
    <div class="totals">
      <div class="total-row">
        <table><tr><td>Subtotal</td><td style="text-align:right">${{ number_format($displaySubtotal, 2) }}</td></tr></table>
      </div>
      <div class="total-row">
        <table><tr><td>GST (5%)</td><td style="text-align:right">${{ number_format($displayGst, 2) }}</td></tr></table>
      </div>
      @if($invoice->credit_card_surcharge > 0)
      <div class="total-row">
        <table><tr><td>Credit Card Surcharge (2%)</td><td style="text-align:right">${{ number_format($invoice->credit_card_surcharge, 2) }}</td></tr></table>
      </div>
      @endif
      @if($invoice->tip > 0)
      <div class="total-row">
        <table><tr><td>Tip</td><td style="text-align:right">${{ number_format($invoice->tip, 2) }}</td></tr></table>
      </div>
      @endif
      <div class="total-row grand">
        <table><tr><td>Total (CAD)</td><td style="text-align:right">${{ number_format($invoice->total, 2) }}</td></tr></table>
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
      <p style="margin: 0 0 6px; font-weight: bold; color: #3B2F2A; font-size: 12px;">Payment Terms &mdash; {{ $methodLabel }}</p>
      @if($billingMethod === 'credit_card')
      <p style="margin: 0; font-size: 12px; color: #5a4a44;">
        Charged automatically to card on file. A 2% credit card surcharge is applied.
      </p>
      @elseif($billingMethod === 'e_transfer')
      <p style="margin: 0; font-size: 12px; color: #5a4a44;">
        Please send your e-Transfer to <strong>sophie@thepupperclub.ca</strong> before the due date.
      </p>
      @elseif($billingMethod === 'cash')
      <p style="margin: 0; font-size: 12px; color: #5a4a44;">
        Cash or cheque can be left at your service address on the first visit of your service period.
      </p>
      @endif
    </div>
    @endif

    @if($invoice->notes)
    <p style="margin-top: 16px; color: #888; font-size: 12px;"><strong>Notes:</strong> {{ $invoice->notes }}</p>
    @endif

    <div class="footer">
      <p>Thank you for choosing The Pupper Club!</p>
      <p>sophie@thepupperclub.ca &middot; Port Moody, BC &middot; thepupperclub.ca</p>
    </div>
  </div>
</div>
</body>
</html>
