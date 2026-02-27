<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ── client_profiles ───────────────────────────────────────────────────
        DB::statement("
            ALTER TABLE client_profiles
              ADD COLUMN emergency_contact_relationship VARCHAR(255) NULL AFTER emergency_contact_phone,
              ADD COLUMN vet_clinic_name VARCHAR(255) NULL,
              ADD COLUMN vet_phone VARCHAR(255) NULL,
              ADD COLUMN vet_address TEXT NULL,
              ADD COLUMN food_storage_location TEXT NULL,
              ADD COLUMN customized_care_options JSON NULL,
              ADD COLUMN preferred_update_method JSON NULL,
              ADD COLUMN report_detail_level VARCHAR(100) NULL,
              ADD COLUMN preferred_walk_days JSON NULL,
              ADD COLUMN preferred_walk_length VARCHAR(50) NULL,
              ADD COLUMN preferred_walk_times JSON NULL,
              ADD COLUMN what_great_care_looks_like TEXT NULL,
              ADD COLUMN biggest_concern TEXT NULL,
              ADD COLUMN comfort_factors TEXT NULL,
              ADD COLUMN referral_source VARCHAR(100) NULL,
              ADD COLUMN additional_notes TEXT NULL,
              ADD COLUMN intake_submitted_at TIMESTAMP NULL
        ");

        // Extend billing_method enum to include ach
        DB::statement("
            ALTER TABLE client_profiles
              MODIFY COLUMN billing_method ENUM('credit_card','e_transfer','cash','ach') NOT NULL DEFAULT 'credit_card'
        ");

        // ── dogs ──────────────────────────────────────────────────────────────
        DB::statement("
            ALTER TABLE dogs
              ADD COLUMN personality_description TEXT NULL,
              ADD COLUMN energy_level VARCHAR(50) NULL,
              ADD COLUMN interaction_dogs VARCHAR(50) NULL,
              ADD COLUMN interaction_strangers VARCHAR(50) NULL,
              ADD COLUMN interaction_children VARCHAR(50) NULL,
              ADD COLUMN triggers TEXT NULL,
              ADD COLUMN preferred_walk_style JSON NULL,
              ADD COLUMN preferred_gear JSON NULL,
              ADD COLUMN treats_allowed VARCHAR(50) NULL,
              ADD COLUMN treats_notes TEXT NULL,
              ADD COLUMN training_commands TEXT NULL,
              ADD COLUMN avoid_on_walks TEXT NULL,
              ADD COLUMN medical_conditions TEXT NULL,
              ADD COLUMN allergies TEXT NULL,
              ADD COLUMN administer_medication_on_visits TINYINT(1) NULL,
              ADD COLUMN mobility_limitations TINYINT(1) NULL,
              ADD COLUMN recent_surgeries TEXT NULL
        ");

        // ── client_documents: add intake_form to type enum ────────────────────
        DB::statement("
            ALTER TABLE client_documents
              MODIFY COLUMN type ENUM('vaccination_record','vet_record','service_agreement','liability_waiver','other','intake_form') NOT NULL
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE client_profiles
              DROP COLUMN IF EXISTS emergency_contact_relationship,
              DROP COLUMN IF EXISTS vet_clinic_name,
              DROP COLUMN IF EXISTS vet_phone,
              DROP COLUMN IF EXISTS vet_address,
              DROP COLUMN IF EXISTS food_storage_location,
              DROP COLUMN IF EXISTS customized_care_options,
              DROP COLUMN IF EXISTS preferred_update_method,
              DROP COLUMN IF EXISTS report_detail_level,
              DROP COLUMN IF EXISTS preferred_walk_days,
              DROP COLUMN IF EXISTS preferred_walk_length,
              DROP COLUMN IF EXISTS preferred_walk_times,
              DROP COLUMN IF EXISTS what_great_care_looks_like,
              DROP COLUMN IF EXISTS biggest_concern,
              DROP COLUMN IF EXISTS comfort_factors,
              DROP COLUMN IF EXISTS referral_source,
              DROP COLUMN IF EXISTS additional_notes,
              DROP COLUMN IF EXISTS intake_submitted_at
        ");

        DB::statement("
            ALTER TABLE dogs
              DROP COLUMN IF EXISTS personality_description,
              DROP COLUMN IF EXISTS energy_level,
              DROP COLUMN IF EXISTS interaction_dogs,
              DROP COLUMN IF EXISTS interaction_strangers,
              DROP COLUMN IF EXISTS interaction_children,
              DROP COLUMN IF EXISTS triggers,
              DROP COLUMN IF EXISTS preferred_walk_style,
              DROP COLUMN IF EXISTS preferred_gear,
              DROP COLUMN IF EXISTS treats_allowed,
              DROP COLUMN IF EXISTS treats_notes,
              DROP COLUMN IF EXISTS training_commands,
              DROP COLUMN IF EXISTS avoid_on_walks,
              DROP COLUMN IF EXISTS medical_conditions,
              DROP COLUMN IF EXISTS allergies,
              DROP COLUMN IF EXISTS administer_medication_on_visits,
              DROP COLUMN IF EXISTS mobility_limitations,
              DROP COLUMN IF EXISTS recent_surgeries
        ");
    }
};
