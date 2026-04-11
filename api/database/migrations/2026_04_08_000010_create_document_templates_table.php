<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('pdf_storage_path');
            $table->string('pdf_filename');
            $table->unsignedInteger('page_count')->default(1);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('document_template_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained('document_templates')->cascadeOnDelete();
            $table->string('label');
            $table->string('field_type', 50); // name, checkbox, date, signature, dog_name, open_text
            $table->unsignedInteger('page')->default(1);
            $table->decimal('x', 8, 2)->default(0);
            $table->decimal('y', 8, 2)->default(0);
            $table->decimal('width', 8, 2)->default(20);
            $table->decimal('height', 8, 2)->default(5);
            $table->boolean('required')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('default_value')->nullable();
            $table->timestamps();
        });

        // Add template-related columns to client_documents
        Schema::table('client_documents', function (Blueprint $table) {
            $table->foreignId('template_id')->nullable()->after('uploaded_by')
                  ->constrained('document_templates')->nullOnDelete();
            $table->string('status', 30)->default('draft')->after('template_id');
            $table->json('field_values')->nullable()->after('status');
            $table->timestamp('sent_at')->nullable()->after('field_values');
            $table->timestamp('expires_at')->nullable()->after('sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('client_documents', function (Blueprint $table) {
            $table->dropForeign(['template_id']);
            $table->dropColumn(['template_id', 'status', 'field_values', 'sent_at', 'expires_at']);
        });

        Schema::dropIfExists('document_template_fields');
        Schema::dropIfExists('document_templates');
    }
};
