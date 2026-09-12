export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      articles: {
        Row: {
          ai_summary: string | null
          author_id: string
          body: string
          countries: string[]
          cover_image_url: string
          created_at: string
          creation_mode: string
          excerpt: string
          id: string
          practice_area_ids: string[]
          read_time_minutes: number
          rejection_reason: string | null
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          author_id: string
          body: string
          countries?: string[]
          cover_image_url: string
          created_at?: string
          creation_mode?: string
          excerpt: string
          id?: string
          practice_area_ids?: string[]
          read_time_minutes: number
          rejection_reason?: string | null
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          author_id?: string
          body?: string
          countries?: string[]
          cover_image_url?: string
          created_at?: string
          creation_mode?: string
          excerpt?: string
          id?: string
          practice_area_ids?: string[]
          read_time_minutes?: number
          rejection_reason?: string | null
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["article_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_requests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          member_id: string
          message: string
          practice_area_id: string | null
          requester_id: string
          response_message: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["consultation_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          member_id: string
          message: string
          practice_area_id?: string | null
          requester_id: string
          response_message?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          member_id?: string
          message?: string
          practice_area_id?: string | null
          requester_id?: string
          response_message?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_practice_area_id_fkey"
            columns: ["practice_area_id"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          end_date: string | null
          event_format: string | null
          event_type: string | null
          id: string
          is_free: boolean
          organiser_name: string | null
          registration_url: string | null
          short_description: string | null
          slug: string
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          timezone: string | null
          title: string
          updated_at: string
          venue_name: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          end_date?: string | null
          event_format?: string | null
          event_type?: string | null
          id?: string
          is_free?: boolean
          organiser_name?: string | null
          registration_url?: string | null
          short_description?: string | null
          slug: string
          start_date: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string | null
          title: string
          updated_at?: string
          venue_name?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          end_date?: string | null
          event_format?: string | null
          event_type?: string | null
          id?: string
          is_free?: boolean
          organiser_name?: string | null
          registration_url?: string | null
          short_description?: string | null
          slug?: string
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string | null
          title?: string
          updated_at?: string
          venue_name?: string | null
        }
        Relationships: []
      }
      member_profile_edits: {
        Row: {
          created_at: string
          id: string
          member_id: string
          payload: Json
          proof_file_url: string | null
          proof_link: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          section: Database["public"]["Enums"]["member_edit_section"]
          status: Database["public"]["Enums"]["member_edit_status"]
          submitted_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          payload: Json
          proof_file_url?: string | null
          proof_link?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section: Database["public"]["Enums"]["member_edit_section"]
          status?: Database["public"]["Enums"]["member_edit_status"]
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          payload?: Json
          proof_file_url?: string | null
          proof_link?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section?: Database["public"]["Enums"]["member_edit_section"]
          status?: Database["public"]["Enums"]["member_edit_status"]
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_profile_edits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "member_profile_edits_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          application_id: string | null
          availability_notes: string | null
          awards: Json
          bio: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string
          credentials: Json
          educations: Json
          engagements: Json
          firm_name: string | null
          firm_website: string | null
          headline: string | null
          id: string
          is_available: boolean
          is_verified: boolean
          key_clients: Json
          linkedin_url: string | null
          member_tier: Database["public"]["Enums"]["membership_tier"]
          membership_started_at: string
          photo_url: string | null
          profile_id: string
          qualifications: Json
          rate_currency: string
          rate_max_cents: number | null
          rate_min_cents: number | null
          region: Database["public"]["Enums"]["application_region"] | null
          renewal_payment_status:
            | Database["public"]["Enums"]["renewal_payment_status"]
            | null
          state: string | null
          status: Database["public"]["Enums"]["member_profile_status"]
          testimonials: Json
          updated_at: string
          website: string | null
          work_experiences: Json
          years_of_experience: number
        }
        Insert: {
          application_id?: string | null
          availability_notes?: string | null
          awards?: Json
          bio?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country: string
          created_at?: string
          credentials?: Json
          educations?: Json
          engagements?: Json
          firm_name?: string | null
          firm_website?: string | null
          headline?: string | null
          id?: string
          is_available?: boolean
          is_verified?: boolean
          key_clients?: Json
          linkedin_url?: string | null
          member_tier: Database["public"]["Enums"]["membership_tier"]
          membership_started_at?: string
          photo_url?: string | null
          profile_id: string
          qualifications?: Json
          rate_currency?: string
          rate_max_cents?: number | null
          rate_min_cents?: number | null
          region?: Database["public"]["Enums"]["application_region"] | null
          renewal_payment_status?:
            | Database["public"]["Enums"]["renewal_payment_status"]
            | null
          state?: string | null
          status?: Database["public"]["Enums"]["member_profile_status"]
          testimonials?: Json
          updated_at?: string
          website?: string | null
          work_experiences?: Json
          years_of_experience: number
        }
        Update: {
          application_id?: string | null
          availability_notes?: string | null
          awards?: Json
          bio?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          credentials?: Json
          educations?: Json
          engagements?: Json
          firm_name?: string | null
          firm_website?: string | null
          headline?: string | null
          id?: string
          is_available?: boolean
          is_verified?: boolean
          key_clients?: Json
          linkedin_url?: string | null
          member_tier?: Database["public"]["Enums"]["membership_tier"]
          membership_started_at?: string
          photo_url?: string | null
          profile_id?: string
          qualifications?: Json
          rate_currency?: string
          rate_max_cents?: number | null
          rate_min_cents?: number | null
          region?: Database["public"]["Enums"]["application_region"] | null
          renewal_payment_status?:
            | Database["public"]["Enums"]["renewal_payment_status"]
            | null
          state?: string | null
          status?: Database["public"]["Enums"]["member_profile_status"]
          testimonials?: Json
          updated_at?: string
          website?: string | null
          work_experiences?: Json
          years_of_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_services: {
        Row: {
          member_id: string
          practice_area_id: string
        }
        Insert: {
          member_id: string
          practice_area_id: string
        }
        Update: {
          member_id?: string
          practice_area_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_services_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "member_services_practice_area_id_fkey"
            columns: ["practice_area_id"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_applications: {
        Row: {
          amount_due_cents: number | null
          applicant_id: string
          background_check_consent: boolean | null
          billing_period: Database["public"]["Enums"]["billing_period"] | null
          bio: string | null
          city: string | null
          contact_email: string | null
          country: string | null
          coupon_code: string | null
          created_at: string
          current_step: number
          discount_amount_cents: number
          documents: Json
          educations: Json
          first_name: string | null
          id: string
          last_name: string | null
          linkedin_import_consent: boolean
          linkedin_url: string | null
          list_price_cents: number | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          phone: string | null
          phone_country_code: string | null
          photo_path: string | null
          privacy_version_agreed: string | null
          rate_max_cents: number | null
          rate_min_cents: number | null
          region: Database["public"]["Enums"]["application_region"] | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selected_tier: Database["public"]["Enums"]["membership_tier"] | null
          service_preferences: Json
          state: string | null
          status: Database["public"]["Enums"]["application_status"]
          terms_version_agreed: string | null
          updated_at: string
          work_experiences: Json
          years_of_experience: number | null
        }
        Insert: {
          amount_due_cents?: number | null
          applicant_id: string
          background_check_consent?: boolean | null
          billing_period?: Database["public"]["Enums"]["billing_period"] | null
          bio?: string | null
          city?: string | null
          contact_email?: string | null
          country?: string | null
          coupon_code?: string | null
          created_at?: string
          current_step?: number
          discount_amount_cents?: number
          documents?: Json
          educations?: Json
          first_name?: string | null
          id?: string
          last_name?: string | null
          linkedin_import_consent?: boolean
          linkedin_url?: string | null
          list_price_cents?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          phone?: string | null
          phone_country_code?: string | null
          photo_path?: string | null
          privacy_version_agreed?: string | null
          rate_max_cents?: number | null
          rate_min_cents?: number | null
          region?: Database["public"]["Enums"]["application_region"] | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_tier?: Database["public"]["Enums"]["membership_tier"] | null
          service_preferences?: Json
          state?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          terms_version_agreed?: string | null
          updated_at?: string
          work_experiences?: Json
          years_of_experience?: number | null
        }
        Update: {
          amount_due_cents?: number | null
          applicant_id?: string
          background_check_consent?: boolean | null
          billing_period?: Database["public"]["Enums"]["billing_period"] | null
          bio?: string | null
          city?: string | null
          contact_email?: string | null
          country?: string | null
          coupon_code?: string | null
          created_at?: string
          current_step?: number
          discount_amount_cents?: number
          documents?: Json
          educations?: Json
          first_name?: string | null
          id?: string
          last_name?: string | null
          linkedin_import_consent?: boolean
          linkedin_url?: string | null
          list_price_cents?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          phone?: string | null
          phone_country_code?: string | null
          photo_path?: string | null
          privacy_version_agreed?: string | null
          rate_max_cents?: number | null
          rate_min_cents?: number | null
          region?: Database["public"]["Enums"]["application_region"] | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_tier?: Database["public"]["Enums"]["membership_tier"] | null
          service_preferences?: Json
          state?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          terms_version_agreed?: string | null
          updated_at?: string
          work_experiences?: Json
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_connect_matches: {
        Row: {
          action_items: Json
          created_at: string
          cycle_month: string
          duration_minutes: number | null
          id: string
          match_rationale: string | null
          meeting_link: string | null
          reschedule_confirmed_date: string | null
          reschedule_proposed_dates: string[] | null
          reschedule_requested_by: string | null
          scheduled_date: string
          scheduled_end_at: string
          scheduled_start_at: string
          status: Database["public"]["Enums"]["peer_connect_match_status"]
          transcript: string | null
          updated_at: string
        }
        Insert: {
          action_items?: Json
          created_at?: string
          cycle_month: string
          duration_minutes?: number | null
          id?: string
          match_rationale?: string | null
          meeting_link?: string | null
          reschedule_confirmed_date?: string | null
          reschedule_proposed_dates?: string[] | null
          reschedule_requested_by?: string | null
          scheduled_date: string
          scheduled_end_at: string
          scheduled_start_at: string
          status?: Database["public"]["Enums"]["peer_connect_match_status"]
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          action_items?: Json
          created_at?: string
          cycle_month?: string
          duration_minutes?: number | null
          id?: string
          match_rationale?: string | null
          meeting_link?: string | null
          reschedule_confirmed_date?: string | null
          reschedule_proposed_dates?: string[] | null
          reschedule_requested_by?: string | null
          scheduled_date?: string
          scheduled_end_at?: string
          scheduled_start_at?: string
          status?: Database["public"]["Enums"]["peer_connect_match_status"]
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_connect_matches_reschedule_requested_by_fkey"
            columns: ["reschedule_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_connect_member_preferences: {
        Row: {
          created_at: string
          cycle_month: string
          feedback: string | null
          id: string
          match_id: string | null
          member_id: string
          note: string | null
          practice_area_ids: string[]
          preferred_countries: string[]
          preferred_hours_end: number | null
          preferred_hours_start: number | null
          rating: number | null
          unmatched_note: string | null
          unmatched_reason:
            | Database["public"]["Enums"]["peer_connect_unmatched_reason"]
            | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_month: string
          feedback?: string | null
          id?: string
          match_id?: string | null
          member_id: string
          note?: string | null
          practice_area_ids?: string[]
          preferred_countries?: string[]
          preferred_hours_end?: number | null
          preferred_hours_start?: number | null
          rating?: number | null
          unmatched_note?: string | null
          unmatched_reason?:
            | Database["public"]["Enums"]["peer_connect_unmatched_reason"]
            | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_month?: string
          feedback?: string | null
          id?: string
          match_id?: string | null
          member_id?: string
          note?: string | null
          practice_area_ids?: string[]
          preferred_countries?: string[]
          preferred_hours_end?: number | null
          preferred_hours_start?: number | null
          rating?: number | null
          unmatched_note?: string | null
          unmatched_reason?:
            | Database["public"]["Enums"]["peer_connect_unmatched_reason"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_connect_member_preferences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "peer_connect_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_connect_member_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_areas: {
        Row: {
          category: Database["public"]["Enums"]["practice_area_category"]
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["practice_area_category"]
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["practice_area_category"]
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_role: Database["public"]["Enums"]["admin_role"] | null
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          avatar_url: string | null
          consent: Json
          created_at: string
          deleted_at: string | null
          deletion_reason: string | null
          email: string
          first_name: string
          id: string
          initials: string | null
          last_login_at: string | null
          last_name: string
          phone: string | null
          phone_country_code: string | null
          role: Database["public"]["Enums"]["profile_role"]
          status: Database["public"]["Enums"]["profile_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          admin_role?: Database["public"]["Enums"]["admin_role"] | null
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          avatar_url?: string | null
          consent?: Json
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          email: string
          first_name: string
          id: string
          initials?: string | null
          last_login_at?: string | null
          last_name: string
          phone?: string | null
          phone_country_code?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role"] | null
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          avatar_url?: string | null
          consent?: Json
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          email?: string
          first_name?: string
          id?: string
          initials?: string | null
          last_login_at?: string | null
          last_name?: string
          phone?: string | null
          phone_country_code?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      admin_role: "super_admin" | "content_manager" | "reviewer"
      application_region:
        | "asia_pacific"
        | "europe"
        | "latin_america"
        | "middle_east"
        | "north_america"
        | "south_asia"
        | "africa"
      application_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
      article_status: "draft" | "published" | "pending_review" | "rejected"
      auth_provider: "email" | "linkedin_oidc" | "google"
      billing_period: "monthly" | "annual"
      consultation_status: "pending" | "completed" | "declined"
      event_status: "draft" | "published"
      member_edit_section:
        | "headline_bio"
        | "contact"
        | "engagements"
        | "education"
        | "work_experiences"
        | "key_clients"
        | "testimonials"
        | "awards"
      member_edit_status: "pending" | "verified" | "rejected"
      member_profile_status: "active" | "deactivated"
      membership_tier: "budding_entrepreneur" | "seasoned_professional"
      payment_status: "pending" | "waived" | "paid"
      peer_connect_match_status: "scheduled" | "completed" | "cancelled"
      peer_connect_unmatched_reason:
        | "odd_headcount"
        | "no_compatible_peer"
        | "inactive_member"
        | "other"
      practice_area_category: "taxation" | "legal" | "finance_advisory"
      profile_role: "client" | "member" | "admin"
      profile_status: "active" | "suspended" | "deleted"
      renewal_payment_status: "paid" | "pending" | "overdue"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ["super_admin", "content_manager", "reviewer"],
      application_region: [
        "asia_pacific",
        "europe",
        "latin_america",
        "middle_east",
        "north_america",
        "south_asia",
        "africa",
      ],
      application_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
      ],
      article_status: ["draft", "published", "pending_review", "rejected"],
      auth_provider: ["email", "linkedin_oidc", "google"],
      billing_period: ["monthly", "annual"],
      consultation_status: ["pending", "completed", "declined"],
      event_status: ["draft", "published"],
      member_edit_section: [
        "headline_bio",
        "contact",
        "engagements",
        "education",
        "work_experiences",
        "key_clients",
        "testimonials",
        "awards",
      ],
      member_edit_status: ["pending", "verified", "rejected"],
      member_profile_status: ["active", "deactivated"],
      membership_tier: ["budding_entrepreneur", "seasoned_professional"],
      payment_status: ["pending", "waived", "paid"],
      peer_connect_match_status: ["scheduled", "completed", "cancelled"],
      peer_connect_unmatched_reason: [
        "odd_headcount",
        "no_compatible_peer",
        "inactive_member",
        "other",
      ],
      practice_area_category: ["taxation", "legal", "finance_advisory"],
      profile_role: ["client", "member", "admin"],
      profile_status: ["active", "suspended", "deleted"],
      renewal_payment_status: ["paid", "pending", "overdue"],
    },
  },
} as const

