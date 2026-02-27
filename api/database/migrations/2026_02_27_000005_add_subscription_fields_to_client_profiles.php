<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->string('subscription_plan')->nullable()->after('subscription_tier');
            $table->decimal('subscription_amount', 8, 2)->nullable()->after('subscription_plan');
            $table->date('next_billing_date')->nullable()->after('subscription_start_date');
            $table->string('stripe_payment_method_id')->nullable()->after('stripe_customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'subscription_plan',
                'subscription_amount',
                'next_billing_date',
                'stripe_payment_method_id',
            ]);
        });
    }
};
