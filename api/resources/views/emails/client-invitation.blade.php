@extends('emails.layout')

@section('body')
  <h2>Welcome, {{ $user->name }}!</h2>
  <div class="content">
    <p>Sophie has set up your client account at <strong>The Pupper Club</strong>. You're just a few steps away from accessing your portal.</p>

    @if($tempPassword)
    <p>Your temporary password is:</p>
    <div style="background: #F6F3EE; border: 1px solid #C8BFB6; border-radius: 8px; padding: 16px 24px; font-family: monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin: 16px 0;">
      {{ $tempPassword }}
    </div>
    @endif

    <p>Click the button below to set your permanent password and get started:</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="{{ $setPasswordUrl }}" style="display: inline-block; background: #C9A24D; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
        Set My Password
      </a>
    </p>

    <p style="font-size: 13px; color: #C8BFB6;">This link expires in 7 days. If you have any questions, reply to this email or contact Sophie directly.</p>
  </div>
@endsection
