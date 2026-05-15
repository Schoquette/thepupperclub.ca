@extends('emails.layout')

@section('body')
  <h2>Reset your password</h2>
  <div class="content">
    <p>Hi {{ $name }},</p>

    <p>We received a request to reset the password on your <strong>The Pupper Club</strong> account. Click the button below to choose a new one:</p>

    <p style="text-align: center; margin: 28px 0;">
      <a href="{{ $url }}" style="display: inline-block; background: #C9A24D; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
        Reset My Password
      </a>
    </p>

    <p style="font-size: 13px; color: #C8BFB6;">
      This link expires in {{ $hours }} hour{{ $hours === 1 ? '' : 's' }}. If you didn't request a password reset, you can safely ignore this email — your password won't change.
    </p>
  </div>
@endsection
