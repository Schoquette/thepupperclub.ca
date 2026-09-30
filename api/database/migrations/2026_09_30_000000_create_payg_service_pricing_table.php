<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payg_service_pricing', function (Blueprint $table) {
            $table->string('service_type')->primary();
            $table->string('stripe_price_id')->nullable();
            $table->unsignedInteger('pack_price_cents')->nullable();
            $table->timestamps();
        });

        foreach (['walk_30', 'walk_60', 'pack_hike'] as $type) {
            \Illuminate\Support\Facades\DB::table('payg_service_pricing')->insert([
                'service_type' => $type,
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payg_service_pricing');
    }
};
