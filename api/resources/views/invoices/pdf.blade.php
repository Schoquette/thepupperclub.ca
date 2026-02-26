<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #3B2F2A; font-size: 13px; margin: 0; padding: 0; }
    .page { padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #C9A24D; padding-bottom: 24px; }
    .brand h1 { color: #3B2F2A; font-size: 24px; margin: 0; letter-spacing: 1px; }
    .brand p { color: #C8BFB6; margin: 4px 0 0; font-size: 12px; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 20px; color: #C9A24D; margin: 0 0 8px; }
    .invoice-meta p { margin: 2px 0; color: #5a4a44; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .status-paid { background: #d4edda; color: #155724; }
    .status-sent { background: #fff3cd; color: #856404; }
    .status-overdue { background: #f8d7da; color: #721c24; }
    .parties { display: flex; gap: 40px; margin-bottom: 32px; }
    .party h4 { color: #C9A24D; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px; }
    .party p { margin: 2px 0; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #3B2F2A; color: #F6F3EE; }
    thead th { padding: 10px 12px; text-align: left; font-size: 12px; }
    tbody tr:nth-child(even) { background: #F6F3EE; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #e9e4df; }
    .totals { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9e4df; }
    .total-row.grand { font-size: 16px; font-weight: bold; color: #3B2F2A; border-top: 2px solid #C9A24D; border-bottom: none; padding-top: 10px; }
    .footer { margin-top: 40px; text-align: center; color: #C8BFB6; font-size: 11px; border-top: 1px solid #e9e4df; padding-top: 16px; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand">
      <h1>THE PUPPER CLUB</h1>
      <p>Premium Dog Walking & Care · Vancouver, BC</p>
      <p>hello@thepupperclub.ca · thepupperclub.ca</p>
    </div>
    <div class="invoice-meta">
      <h2>INVOICE</h2>
      <p><strong>{{ $invoice->invoice_number }}</strong></p>
      <p>Date: {{ $invoice->created_at->format('F j, Y') }}</p>
      @if($invoice->due_date)
      <p>Due: {{ $invoice->due_date->format('F j, Y') }}</p>
      @endif
      <span class="status-badge status-{{ $invoice->status }}">{{ ucfirst($invoice->status) }}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h4>From</h4>
      <p><strong>The Pupper Club</strong></p>
      <p>Sophie Choquette</p>
      <p>Vancouver, BC</p>
    </div>
    <div class="party">
      <h4>Bill To</h4>
      <p><strong>{{ $invoice->user->name }}</strong></p>
      <p>{{ $invoice->user->email }}</p>
      @if($invoice->user->clientProfile?->address)
      <p>{{ $invoice->user->clientProfile->address }}</p>
      <p>{{ $invoice->user->clientProfile->city }}, {{ $invoice->user->clientProfile->province }} {{ $invoice->user->clientProfile->postal_code }}</p>
      @endif
    </div>
  </div>

  <table>
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

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>${{ number_format($invoice->subtotal, 2) }}</span>
    </div>
    <div class="total-row">
      <span>GST (5%)</span>
      <span>${{ number_format($invoice->gst, 2) }}</span>
    </div>
    @if($invoice->credit_card_surcharge > 0)
    <div class="total-row">
      <span>Credit Card Fee (2.9%)</span>
      <span>${{ number_format($invoice->credit_card_surcharge, 2) }}</span>
    </div>
    @endif
    @if($invoice->tip > 0)
    <div class="total-row">
      <span>Tip</span>
      <span>${{ number_format($invoice->tip, 2) }}</span>
    </div>
    @endif
    <div class="total-row grand">
      <span>Total (CAD)</span>
      <span>${{ number_format($invoice->total, 2) }}</span>
    </div>
  </div>

  @if($invoice->notes)
  <p style="margin-top: 32px; color: #888; font-size: 12px;"><strong>Notes:</strong> {{ $invoice->notes }}</p>
  @endif

  <div class="footer">
    <p>Thank you for choosing The Pupper Club! 🐾</p>
    <p>Questions? hello@thepupperclub.ca</p>
  </div>
</div>
</body>
</html>
