<p>Hi {{ $userName }},</p>

@if(!empty($customMessage))
  <p>{!! nl2br(e($customMessage)) !!}</p>
  <p style="font-size: 13px; color: #5a4a44;">
    Invoice <strong>{{ $invoiceNumber }}</strong> &middot; <strong>${{ $total }} CAD</strong>
    @if($dueDate) &middot; Due {{ $dueDate }} @endif
  </p>
  @if($billingPeriod)
    <p style="font-size: 13px; color: #C8BFB6;">Service period: {{ $billingPeriod }}</p>
  @endif
@elseif($type === 'invoice')
  <p>Your invoice <strong>{{ $invoiceNumber }}</strong> for <strong>${{ $total }} CAD</strong> is ready.</p>
  @if($billingPeriod)
    <p style="font-size: 13px; color: #C8BFB6;">Service period: {{ $billingPeriod }}</p>
  @endif
  @if($dueDate)
    <p>Payment is due by <strong>{{ $dueDate }}</strong>.</p>
  @endif
@elseif($type === 'reminder')
  <p>This is a friendly reminder that your payment of <strong>${{ $total }} CAD</strong> (Invoice {{ $invoiceNumber }}) will be processed in <strong>3 days</strong> on <strong>{{ $dueDate }}</strong>.</p>
  @if($billingPeriod)
    <p style="font-size: 13px; color: #C8BFB6;">Service period: {{ $billingPeriod }}</p>
  @endif
  <p>If you'd like to update your payment method before then, you can do so below.</p>
@elseif($type === 'paid')
  <p>Your invoice <strong>{{ $invoiceNumber }}</strong> for <strong>${{ $total }} CAD</strong> has been paid.</p>
  <p>Thank you for your payment, and being an awesome client!</p>
  @if($billingPeriod)
    <p style="font-size: 13px; color: #C8BFB6;">Service period: {{ $billingPeriod }}</p>
  @endif
@endif

@if($paymentMethod)
  <p style="font-size: 13px; color: #5a4a44;">
    Payment method: <strong>{{ $paymentMethod }}</strong>
  </p>
@endif

<p style="text-align: center; margin: 28px 0;">
  <a href="{{ $portalUrl }}" style="display: inline-block; background: #C9A24D; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 15px;">
    {{ $type === 'reminder' ? 'Update Payment Method' : 'View in Portal' }}
  </a>
</p>

<p>Thanks,<br>Sophie — The Pupper Club</p>
