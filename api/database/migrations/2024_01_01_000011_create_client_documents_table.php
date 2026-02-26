<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dog_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['vaccination_record', 'vet_record', 'service_agreement', 'liability_waiver', 'other']);
            $table->string('filename');
            $table->string('mime_type');
            $table->unsignedInteger('size_bytes');
            $table->string('storage_path');
            $table->enum('uploaded_by', ['admin', 'client'])->default('client');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_documents');
    }
};
