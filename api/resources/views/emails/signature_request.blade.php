@extends('emails.layout')

@section('body')
  <h2>Document Ready for Your Signature</h2>
  <div class="content">
    <p>Hi {{ $userName }},</p>

    <p>A document has been sent to you for review and signature:</p>

    <p style="background: #F6F3EE; border-radius: 8px; padding: 14px 18px; font-size: 14px;">
      <strong style="color: #3B2F2A;">{{ $documentName }}</strong>
    </p>

    <p>Please review the document carefully and provide your electronic signature at the link below.</p>

    <p style="text-align: center; margin: 28px 0;">
      <a href="{{ $signingUrl }}" style="display: inline-block; background: #C9A24D; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: bold; font-size: 15px;">
        Review &amp; Sign Document
      </a>
    </p>

    <p style="font-size: 13px; color: #C8BFB6;">
      This link is unique to you. Once signed, it cannot be reused.
    </p>

    <p>Thanks,<br>Sophie — The Pupper Club</p>
  </div>
@endsection
