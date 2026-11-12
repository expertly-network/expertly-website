export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ai_draft_generations: {
        Row: {
          author_id: string;
          core_answers: NonNullable<Json>;
          countries: string[];
          created_at: string;
          draft_body: string | null;
          draft_title: string | null;
          error_message: string | null;
          extra_instructions: string | null;
          followup_answers: NonNullable<Json>;
          followup_questions: NonNullable<Json>;
          id: string;
          include_visual: boolean;
          latency_ms: number | null;
          model: string | null;
          provider: string | null;
          service_ids: string[];
          source_file_paths: string[];
          source_links: string[];
          sources: NonNullable<Json>;
          state: string | null;
          status: string;
          tone: string | null;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          core_answers: NonNullable<Json>;
          countries?: string[];
          created_at?: string;
          draft_body?: string | null;
          draft_title?: string | null;
          error_message?: string | null;
          extra_instructions?: string | null;
          followup_answers?: NonNullable<Json>;
          followup_questions?: NonNullable<Json>;
          id?: string;
          include_visual?: boolean;
          latency_ms?: number | null;
          model?: string | null;
          provider?: string | null;
          service_ids?: string[];
          source_file_paths?: string[];
          source_links?: string[];
          sources?: NonNullable<Json>;
          state?: string | null;
          status: string;
          tone?: string | null;
        };
        Update: {
          author_id?: string;
          core_answers?: NonNullable<Json>;
          countries?: string[];
          created_at?: string;
          draft_body?: string | null;
          draft_title?: string | null;
          error_message?: string | null;
          extra_instructions?: string | null;
          followup_answers?: NonNullable<Json>;
          followup_questions?: NonNullable<Json>;
          id?: string;
          include_visual?: boolean;
          latency_ms?: number | null;
          model?: string | null;
          provider?: string | null;
          service_ids?: string[];
          source_file_paths?: string[];
          source_links?: string[];
          sources?: NonNullable<Json>;
          state?: string | null;
          status?: string;
          tone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_draft_generations_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      articles: {
        Row: {
          ai_generation_id: string | null;
          ai_summary: string | null;
          author_id: string;
          body: string;
          countries: string[];
          cover_image_url: string;
          created_at: string;
          creation_mode: string;
          custom_service_labels: NonNullable<Json>;
          excerpt: string;
          id: string;
          read_time_minutes: number;
          rejection_reason: string | null;
          service_ids: string[];
          slug: string;
          state: string | null;
          status: Database["public"]["Enums"]["article_status"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ai_generation_id?: string | null;
          ai_summary?: string | null;
          author_id: string;
          body: string;
          countries?: string[];
          cover_image_url: string;
          created_at?: string;
          creation_mode?: string;
          custom_service_labels?: NonNullable<Json>;
          excerpt: string;
          id?: string;
          read_time_minutes: number;
          rejection_reason?: string | null;
          service_ids?: string[];
          slug: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["article_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          ai_generation_id?: string | null;
          ai_summary?: string | null;
          author_id?: string;
          body?: string;
          countries?: string[];
          cover_image_url?: string;
          created_at?: string;
          creation_mode?: string;
          custom_service_labels?: NonNullable<Json>;
          excerpt?: string;
          id?: string;
          read_time_minutes?: number;
          rejection_reason?: string | null;
          service_ids?: string[];
          slug?: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["article_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "articles_ai_generation_id_fkey";
            columns: ["ai_generation_id"];
            isOneToOne: false;
            referencedRelation: "ai_draft_generations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "articles_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          service_line_id: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          service_line_id: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          service_line_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_service_line_id_fkey";
            columns: ["service_line_id"];
            isOneToOne: false;
            referencedRelation: "service_lines";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: {
          audiences: string[];
          cover_image_url: string | null;
          created_at: string;
          description: string;
          id: string;
          is_active: boolean;
          item_ids: string[];
          kind: string;
          slug: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          audiences?: string[];
          cover_image_url?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          is_active?: boolean;
          item_ids?: string[];
          kind: string;
          slug: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          audiences?: string[];
          cover_image_url?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          is_active?: boolean;
          item_ids?: string[];
          kind?: string;
          slug?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      consent_policies: {
        Row: {
          created_at: string;
          file_path: string;
          id: string;
          slug: string;
          status: Database["public"]["Enums"]["consent_policy_status"];
          title: string;
          version_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          file_path: string;
          id?: string;
          slug: string;
          status?: Database["public"]["Enums"]["consent_policy_status"];
          title: string;
          version_id: string;
        };
        Update: {
          created_at?: string;
          file_path?: string;
          id?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["consent_policy_status"];
          title?: string;
          version_id?: string;
        };
        Relationships: [];
      };
      consultation_messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          request_id: string;
          sender_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          request_id: string;
          sender_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          request_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultation_messages_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "consultation_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultation_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      consultation_requests: {
        Row: {
          created_at: string;
          custom_service_label: string | null;
          description: string | null;
          id: string;
          member_id: string;
          message: string;
          rating: number | null;
          requester_contact_email: string;
          requester_id: string;
          requester_name: string;
          requester_phone: string;
          response_message: string | null;
          scheduled_at: string | null;
          service_id: string | null;
          status: Database["public"]["Enums"]["consultation_status"];
          subject: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          custom_service_label?: string | null;
          description?: string | null;
          id?: string;
          member_id: string;
          message: string;
          rating?: number | null;
          requester_contact_email: string;
          requester_id: string;
          requester_name: string;
          requester_phone: string;
          response_message?: string | null;
          scheduled_at?: string | null;
          service_id?: string | null;
          status?: Database["public"]["Enums"]["consultation_status"];
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          custom_service_label?: string | null;
          description?: string | null;
          id?: string;
          member_id?: string;
          message?: string;
          rating?: number | null;
          requester_contact_email?: string;
          requester_id?: string;
          requester_name?: string;
          requester_phone?: string;
          response_message?: string | null;
          scheduled_at?: string | null;
          service_id?: string | null;
          status?: Database["public"]["Enums"]["consultation_status"];
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultation_requests_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultation_requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultation_requests_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_stats: {
        Row: {
          count: number;
          day: string;
          metric: string;
          subject_id: string;
          subject_type: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          day: string;
          metric: string;
          subject_id: string;
          subject_type: string;
        };
        Update: {
          count?: number;
          day?: string;
          metric?: string;
          subject_id?: string;
          subject_type?: string;
        };
        Relationships: [];
      };
      email_automations: {
        Row: {
          description: string | null;
          enabled: boolean;
          key: string;
          name: string;
          resend_template: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          enabled?: boolean;
          key: string;
          name: string;
          resend_template: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          description?: string | null;
          enabled?: boolean;
          key?: string;
          name?: string;
          resend_template?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_automations_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_messages: {
        Row: {
          attempts: number;
          automation_key: string;
          claim_count: number;
          claimed_at: string | null;
          created_at: string;
          delivered_at: string | null;
          id: string;
          idempotency_key: string | null;
          last_error: string | null;
          manual_retries: number;
          next_attempt_at: string;
          provider_message_id: string | null;
          recipient_profile_id: string | null;
          resend_template: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["email_message_status"];
          to_email: string;
          variables: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          automation_key: string;
          claim_count?: number;
          claimed_at?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          last_error?: string | null;
          manual_retries?: number;
          next_attempt_at?: string;
          provider_message_id?: string | null;
          recipient_profile_id?: string | null;
          resend_template: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["email_message_status"];
          to_email: string;
          variables?: NonNullable<Json>;
        };
        Update: {
          attempts?: number;
          automation_key?: string;
          claim_count?: number;
          claimed_at?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          last_error?: string | null;
          manual_retries?: number;
          next_attempt_at?: string;
          provider_message_id?: string | null;
          recipient_profile_id?: string | null;
          resend_template?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["email_message_status"];
          to_email?: string;
          variables?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "email_messages_automation_key_fkey";
            columns: ["automation_key"];
            isOneToOne: false;
            referencedRelation: "email_automations";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "email_messages_recipient_profile_id_fkey";
            columns: ["recipient_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_suppressions: {
        Row: {
          created_at: string;
          email: string;
          reason: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          reason: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          reason?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          category_ids: string[];
          city: string | null;
          country: string | null;
          cover_image_url: string | null;
          created_at: string;
          description: string;
          end_date: string | null;
          event_format: string | null;
          event_type: string | null;
          id: string;
          is_free: boolean;
          organiser_name: string | null;
          registration_url: string | null;
          short_description: string | null;
          slug: string;
          start_date: string;
          status: Database["public"]["Enums"]["event_status"];
          timezone: string | null;
          title: string;
          updated_at: string;
          venue_name: string | null;
        };
        ComputedFields: never;
        Insert: {
          category_ids?: string[];
          city?: string | null;
          country?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string;
          end_date?: string | null;
          event_format?: string | null;
          event_type?: string | null;
          id?: string;
          is_free?: boolean;
          organiser_name?: string | null;
          registration_url?: string | null;
          short_description?: string | null;
          slug: string;
          start_date: string;
          status?: Database["public"]["Enums"]["event_status"];
          timezone?: string | null;
          title: string;
          updated_at?: string;
          venue_name?: string | null;
        };
        Update: {
          category_ids?: string[];
          city?: string | null;
          country?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string;
          end_date?: string | null;
          event_format?: string | null;
          event_type?: string | null;
          id?: string;
          is_free?: boolean;
          organiser_name?: string | null;
          registration_url?: string | null;
          short_description?: string | null;
          slug?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["event_status"];
          timezone?: string | null;
          title?: string;
          updated_at?: string;
          venue_name?: string | null;
        };
        Relationships: [];
      };
      facet_value_sources: {
        Row: {
          created_at: string;
          facet_value_id: string;
          member_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          facet_value_id: string;
          member_id: string;
        };
        Update: {
          created_at?: string;
          facet_value_id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "facet_value_sources_facet_value_id_fkey";
            columns: ["facet_value_id"];
            isOneToOne: false;
            referencedRelation: "facet_values";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facet_value_sources_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "member_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      facet_values: {
        Row: {
          aliases: string[];
          created_at: string;
          facet: Database["public"]["Enums"]["facet_kind"];
          id: string;
          label: string;
          slug: string;
          source_count: number;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          aliases?: string[];
          created_at?: string;
          facet: Database["public"]["Enums"]["facet_kind"];
          id?: string;
          label: string;
          slug: string;
          source_count?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          created_at?: string;
          facet?: Database["public"]["Enums"]["facet_kind"];
          id?: string;
          label?: string;
          slug?: string;
          source_count?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      interview_review_flags: {
        Row: {
          claim_id: string;
          claim_text: string;
          created_at: string;
          evidence: NonNullable<Json>;
          id: string;
          interview_id: string;
          member_id: string;
          reason: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          scoring_id: string;
          service_ids: string[];
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          claim_id: string;
          claim_text: string;
          created_at?: string;
          evidence?: NonNullable<Json>;
          id?: string;
          interview_id: string;
          member_id: string;
          reason: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          scoring_id: string;
          service_ids?: string[];
          status?: string;
          updated_at?: string;
        };
        Update: {
          claim_id?: string;
          claim_text?: string;
          created_at?: string;
          evidence?: NonNullable<Json>;
          id?: string;
          interview_id?: string;
          member_id?: string;
          reason?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          scoring_id?: string;
          service_ids?: string[];
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_review_flags_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "member_interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_review_flags_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "member_profiles";
            referencedColumns: ["profile_id"];
          },
          {
            foreignKeyName: "interview_review_flags_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_review_flags_scoring_id_fkey";
            columns: ["scoring_id"];
            isOneToOne: false;
            referencedRelation: "interview_scorings";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_scorings: {
        Row: {
          created_at: string;
          id: string;
          interview_id: string;
          is_current: boolean;
          model: string;
          result: NonNullable<Json>;
          rubric_version: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          interview_id: string;
          is_current?: boolean;
          model: string;
          result: NonNullable<Json>;
          rubric_version: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          interview_id?: string;
          is_current?: boolean;
          model?: string;
          result?: NonNullable<Json>;
          rubric_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_scorings_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "member_interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      learnings: {
        Row: {
          access: string;
          audiences: string[];
          category: string;
          channel: string | null;
          created_at: string;
          duration_minutes: number;
          id: string;
          is_active: boolean;
          is_featured: boolean;
          level: string;
          search_tsv: unknown;
          sort_order: number;
          summary: string;
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
          video_provider: string;
          video_url: string;
        };
        ComputedFields: never;
        Insert: {
          access?: string;
          audiences?: string[];
          category: string;
          channel?: string | null;
          created_at?: string;
          duration_minutes: number;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          level: string;
          search_tsv?: never;
          sort_order?: number;
          summary?: string;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
          video_provider?: string;
          video_url: string;
        };
        Update: {
          access?: string;
          audiences?: string[];
          category?: string;
          channel?: string | null;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          level?: string;
          search_tsv?: never;
          sort_order?: number;
          summary?: string;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
          video_provider?: string;
          video_url?: string;
        };
        Relationships: [];
      };
      member_interview_connections: {
        Row: {
          audio_path: string | null;
          audio_received_at: string | null;
          created_at: string;
          duration_seconds: number | null;
          elevenlabs_conversation_id: string | null;
          ended_at: string | null;
          id: string;
          interview_id: string;
          session_token_expires_at: string;
          session_token_hash: string;
          started_at: string;
          transcript: Json | null;
          transcript_received_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          audio_path?: string | null;
          audio_received_at?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          elevenlabs_conversation_id?: string | null;
          ended_at?: string | null;
          id?: string;
          interview_id: string;
          session_token_expires_at: string;
          session_token_hash: string;
          started_at?: string;
          transcript?: Json | null;
          transcript_received_at?: string | null;
        };
        Update: {
          audio_path?: string | null;
          audio_received_at?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          elevenlabs_conversation_id?: string | null;
          ended_at?: string | null;
          id?: string;
          interview_id?: string;
          session_token_expires_at?: string;
          session_token_hash?: string;
          started_at?: string;
          transcript?: Json | null;
          transcript_received_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "member_interview_connections_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "member_interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      member_interviews: {
        Row: {
          audio_opt_in: boolean;
          consent_at: string;
          consent_version: string;
          created_at: string;
          drafts: Json | null;
          elapsed_seconds: number;
          ended_at: string | null;
          extract_attempts: number;
          extract_claimed_at: string | null;
          failure_reason: string | null;
          id: string;
          ledger: Json | null;
          llm_usage: NonNullable<Json>;
          member_id: string;
          plan: Json | null;
          reconnect_until: string | null;
          state: NonNullable<Json>;
          state_version: number;
          status: Database["public"]["Enums"]["interview_status"];
          summary: string | null;
          summary_status: string | null;
          updated_at: string;
          verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          audio_opt_in?: boolean;
          consent_at: string;
          consent_version: string;
          created_at?: string;
          drafts?: Json | null;
          elapsed_seconds?: number;
          ended_at?: string | null;
          extract_attempts?: number;
          extract_claimed_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          ledger?: Json | null;
          llm_usage?: NonNullable<Json>;
          member_id: string;
          plan?: Json | null;
          reconnect_until?: string | null;
          state?: NonNullable<Json>;
          state_version?: number;
          status?: Database["public"]["Enums"]["interview_status"];
          summary?: string | null;
          summary_status?: string | null;
          updated_at?: string;
          verified_at?: string | null;
        };
        Update: {
          audio_opt_in?: boolean;
          consent_at?: string;
          consent_version?: string;
          created_at?: string;
          drafts?: Json | null;
          elapsed_seconds?: number;
          ended_at?: string | null;
          extract_attempts?: number;
          extract_claimed_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          ledger?: Json | null;
          llm_usage?: NonNullable<Json>;
          member_id?: string;
          plan?: Json | null;
          reconnect_until?: string | null;
          state?: NonNullable<Json>;
          state_version?: number;
          status?: Database["public"]["Enums"]["interview_status"];
          summary?: string | null;
          summary_status?: string | null;
          updated_at?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "member_interviews_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "member_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      member_profile_edits: {
        Row: {
          created_at: string;
          id: string;
          item_reviews: Json | null;
          member_id: string;
          payload: NonNullable<Json>;
          proof_file_url: string | null;
          proof_link: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          section: Database["public"]["Enums"]["member_edit_section"];
          status: Database["public"]["Enums"]["member_edit_status"];
          submitted_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          item_reviews?: Json | null;
          member_id: string;
          payload: NonNullable<Json>;
          proof_file_url?: string | null;
          proof_link?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          section: Database["public"]["Enums"]["member_edit_section"];
          status?: Database["public"]["Enums"]["member_edit_status"];
          submitted_at?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_reviews?: Json | null;
          member_id?: string;
          payload?: NonNullable<Json>;
          proof_file_url?: string | null;
          proof_link?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          section?: Database["public"]["Enums"]["member_edit_section"];
          status?: Database["public"]["Enums"]["member_edit_status"];
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_profile_edits_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "member_profiles";
            referencedColumns: ["profile_id"];
          },
          {
            foreignKeyName: "member_profile_edits_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      member_profiles: {
        Row: {
          application_id: string | null;
          availability_notes: string | null;
          awards: NonNullable<Json>;
          bio: string | null;
          city: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          country: string;
          created_at: string;
          credentials: NonNullable<Json>;
          educations: NonNullable<Json>;
          engagements: NonNullable<Json>;
          firm_name: string | null;
          firm_website: string | null;
          headline: string | null;
          id: string;
          is_available: boolean;
          is_verified: boolean;
          key_clients: NonNullable<Json>;
          linkedin_url: string | null;
          member_tier: Database["public"]["Enums"]["membership_tier"];
          membership_started_at: string;
          photo_path: string | null;
          profile_id: string;
          qualifications: NonNullable<Json>;
          rate_currency: string;
          rate_max_cents: number | null;
          rate_min_cents: number | null;
          region: Database["public"]["Enums"]["application_region"] | null;
          renewal_payment_status: Database["public"]["Enums"]["renewal_payment_status"] | null;
          slug: string;
          state: string | null;
          status: Database["public"]["Enums"]["member_profile_status"];
          testimonials: NonNullable<Json>;
          updated_at: string;
          website: string | null;
          work_email: string | null;
          work_experiences: NonNullable<Json>;
          years_of_experience: number;
        };
        ComputedFields: never;
        Insert: {
          application_id?: string | null;
          availability_notes?: string | null;
          awards?: NonNullable<Json>;
          bio?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          country: string;
          created_at?: string;
          credentials?: NonNullable<Json>;
          educations?: NonNullable<Json>;
          engagements?: NonNullable<Json>;
          firm_name?: string | null;
          firm_website?: string | null;
          headline?: string | null;
          id?: string;
          is_available?: boolean;
          is_verified?: boolean;
          key_clients?: NonNullable<Json>;
          linkedin_url?: string | null;
          member_tier: Database["public"]["Enums"]["membership_tier"];
          membership_started_at?: string;
          photo_path?: string | null;
          profile_id: string;
          qualifications?: NonNullable<Json>;
          rate_currency?: string;
          rate_max_cents?: number | null;
          rate_min_cents?: number | null;
          region?: Database["public"]["Enums"]["application_region"] | null;
          renewal_payment_status?: Database["public"]["Enums"]["renewal_payment_status"] | null;
          slug: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["member_profile_status"];
          testimonials?: NonNullable<Json>;
          updated_at?: string;
          website?: string | null;
          work_email?: string | null;
          work_experiences?: NonNullable<Json>;
          years_of_experience: number;
        };
        Update: {
          application_id?: string | null;
          availability_notes?: string | null;
          awards?: NonNullable<Json>;
          bio?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          country?: string;
          created_at?: string;
          credentials?: NonNullable<Json>;
          educations?: NonNullable<Json>;
          engagements?: NonNullable<Json>;
          firm_name?: string | null;
          firm_website?: string | null;
          headline?: string | null;
          id?: string;
          is_available?: boolean;
          is_verified?: boolean;
          key_clients?: NonNullable<Json>;
          linkedin_url?: string | null;
          member_tier?: Database["public"]["Enums"]["membership_tier"];
          membership_started_at?: string;
          photo_path?: string | null;
          profile_id?: string;
          qualifications?: NonNullable<Json>;
          rate_currency?: string;
          rate_max_cents?: number | null;
          rate_min_cents?: number | null;
          region?: Database["public"]["Enums"]["application_region"] | null;
          renewal_payment_status?: Database["public"]["Enums"]["renewal_payment_status"] | null;
          slug?: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["member_profile_status"];
          testimonials?: NonNullable<Json>;
          updated_at?: string;
          website?: string | null;
          work_email?: string | null;
          work_experiences?: NonNullable<Json>;
          years_of_experience?: number;
        };
        Relationships: [
          {
            foreignKeyName: "member_profiles_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "membership_applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      member_recommendations: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          hidden_at: string | null;
          id: string;
          is_hidden: boolean;
          recipient_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          is_hidden?: boolean;
          recipient_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          is_hidden?: boolean;
          recipient_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_recommendations_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "member_profiles";
            referencedColumns: ["profile_id"];
          },
          {
            foreignKeyName: "member_recommendations_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "member_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      member_service_evidence: {
        Row: {
          created_at: string;
          evidence: string;
          evidence_summary: string;
          interview_id: string;
          member_id: string;
          recency_year: number | null;
          role: number;
          scoring_id: string;
          service_id: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          evidence: string;
          evidence_summary: string;
          interview_id: string;
          member_id: string;
          recency_year?: number | null;
          role: number;
          scoring_id: string;
          service_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          evidence?: string;
          evidence_summary?: string;
          interview_id?: string;
          member_id?: string;
          recency_year?: number | null;
          role?: number;
          scoring_id?: string;
          service_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_service_evidence_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "member_interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_service_evidence_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "member_profiles";
            referencedColumns: ["profile_id"];
          },
          {
            foreignKeyName: "member_service_evidence_scoring_id_fkey";
            columns: ["scoring_id"];
            isOneToOne: false;
            referencedRelation: "interview_scorings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_service_evidence_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      member_service_subtags: {
        Row: {
          created_at: string;
          facet_value_id: string;
          member_id: string;
          service_id: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          facet_value_id: string;
          member_id: string;
          service_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          facet_value_id?: string;
          member_id?: string;
          service_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_service_subtags_facet_value_id_fkey";
            columns: ["facet_value_id"];
            isOneToOne: false;
            referencedRelation: "facet_values";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_service_subtags_member_id_service_id_fkey";
            columns: ["member_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "member_service_evidence";
            referencedColumns: ["member_id", "service_id"];
          },
        ];
      };
      member_services: {
        Row: {
          custom_label: string | null;
          member_id: string;
          service_id: string;
        };
        ComputedFields: never;
        Insert: {
          custom_label?: string | null;
          member_id: string;
          service_id: string;
        };
        Update: {
          custom_label?: string | null;
          member_id?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_services_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "member_profiles";
            referencedColumns: ["profile_id"];
          },
          {
            foreignKeyName: "member_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      membership_applications: {
        Row: {
          amount_due_cents: number | null;
          applicant_id: string;
          background_check_consent: string | null;
          billing_period: Database["public"]["Enums"]["billing_period"] | null;
          bio: string | null;
          city: string | null;
          contact_email: string | null;
          country: string | null;
          coupon_code: string | null;
          created_at: string;
          current_step: number;
          discount_amount_cents: number;
          documents: NonNullable<Json>;
          educations: NonNullable<Json>;
          first_name: string | null;
          id: string;
          last_name: string | null;
          linkedin_import_consent: string | null;
          linkedin_url: string | null;
          list_price_cents: number | null;
          payment_status: Database["public"]["Enums"]["payment_status"] | null;
          peer_references: NonNullable<Json>;
          phone: string | null;
          phone_country_code: string | null;
          photo_path: string | null;
          privacy_version_agreed: string | null;
          rate_max_cents: number | null;
          rate_min_cents: number | null;
          region: Database["public"]["Enums"]["application_region"] | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          selected_tier: Database["public"]["Enums"]["membership_tier"] | null;
          service_preferences: NonNullable<Json>;
          state: string | null;
          status: Database["public"]["Enums"]["application_status"];
          terms_version_agreed: string | null;
          updated_at: string;
          work_email: string | null;
          work_experiences: NonNullable<Json>;
          years_of_experience: number | null;
        };
        ComputedFields: never;
        Insert: {
          amount_due_cents?: number | null;
          applicant_id: string;
          background_check_consent?: string | null;
          billing_period?: Database["public"]["Enums"]["billing_period"] | null;
          bio?: string | null;
          city?: string | null;
          contact_email?: string | null;
          country?: string | null;
          coupon_code?: string | null;
          created_at?: string;
          current_step?: number;
          discount_amount_cents?: number;
          documents?: NonNullable<Json>;
          educations?: NonNullable<Json>;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          linkedin_import_consent?: string | null;
          linkedin_url?: string | null;
          list_price_cents?: number | null;
          payment_status?: Database["public"]["Enums"]["payment_status"] | null;
          peer_references?: NonNullable<Json>;
          phone?: string | null;
          phone_country_code?: string | null;
          photo_path?: string | null;
          privacy_version_agreed?: string | null;
          rate_max_cents?: number | null;
          rate_min_cents?: number | null;
          region?: Database["public"]["Enums"]["application_region"] | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          selected_tier?: Database["public"]["Enums"]["membership_tier"] | null;
          service_preferences?: NonNullable<Json>;
          state?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          terms_version_agreed?: string | null;
          updated_at?: string;
          work_email?: string | null;
          work_experiences?: NonNullable<Json>;
          years_of_experience?: number | null;
        };
        Update: {
          amount_due_cents?: number | null;
          applicant_id?: string;
          background_check_consent?: string | null;
          billing_period?: Database["public"]["Enums"]["billing_period"] | null;
          bio?: string | null;
          city?: string | null;
          contact_email?: string | null;
          country?: string | null;
          coupon_code?: string | null;
          created_at?: string;
          current_step?: number;
          discount_amount_cents?: number;
          documents?: NonNullable<Json>;
          educations?: NonNullable<Json>;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          linkedin_import_consent?: string | null;
          linkedin_url?: string | null;
          list_price_cents?: number | null;
          payment_status?: Database["public"]["Enums"]["payment_status"] | null;
          peer_references?: NonNullable<Json>;
          phone?: string | null;
          phone_country_code?: string | null;
          photo_path?: string | null;
          privacy_version_agreed?: string | null;
          rate_max_cents?: number | null;
          rate_min_cents?: number | null;
          region?: Database["public"]["Enums"]["application_region"] | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          selected_tier?: Database["public"]["Enums"]["membership_tier"] | null;
          service_preferences?: NonNullable<Json>;
          state?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          terms_version_agreed?: string | null;
          updated_at?: string;
          work_email?: string | null;
          work_experiences?: NonNullable<Json>;
          years_of_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "membership_applications_applicant_id_fkey";
            columns: ["applicant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "membership_applications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      peer_connect_matches: {
        Row: {
          action_items: NonNullable<Json>;
          created_at: string;
          cycle_month: string;
          duration_minutes: number | null;
          id: string;
          match_rationale: string | null;
          meeting_link: string | null;
          reschedule_confirmed_date: string | null;
          reschedule_proposed_dates: string[] | null;
          reschedule_requested_by: string | null;
          scheduled_date: string;
          scheduled_end_at: string;
          scheduled_start_at: string;
          status: Database["public"]["Enums"]["peer_connect_match_status"];
          transcript: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          action_items?: NonNullable<Json>;
          created_at?: string;
          cycle_month: string;
          duration_minutes?: number | null;
          id?: string;
          match_rationale?: string | null;
          meeting_link?: string | null;
          reschedule_confirmed_date?: string | null;
          reschedule_proposed_dates?: string[] | null;
          reschedule_requested_by?: string | null;
          scheduled_date: string;
          scheduled_end_at: string;
          scheduled_start_at: string;
          status?: Database["public"]["Enums"]["peer_connect_match_status"];
          transcript?: string | null;
          updated_at?: string;
        };
        Update: {
          action_items?: NonNullable<Json>;
          created_at?: string;
          cycle_month?: string;
          duration_minutes?: number | null;
          id?: string;
          match_rationale?: string | null;
          meeting_link?: string | null;
          reschedule_confirmed_date?: string | null;
          reschedule_proposed_dates?: string[] | null;
          reschedule_requested_by?: string | null;
          scheduled_date?: string;
          scheduled_end_at?: string;
          scheduled_start_at?: string;
          status?: Database["public"]["Enums"]["peer_connect_match_status"];
          transcript?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "peer_connect_matches_reschedule_requested_by_fkey";
            columns: ["reschedule_requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      peer_connect_member_preferences: {
        Row: {
          created_at: string;
          custom_service_labels: NonNullable<Json>;
          cycle_month: string;
          feedback: string | null;
          id: string;
          match_id: string | null;
          member_id: string;
          note: string | null;
          preferred_countries: string[];
          preferred_hours_end: number | null;
          preferred_hours_start: number | null;
          rating: number | null;
          service_ids: string[];
          unmatched_note: string | null;
          unmatched_reason: Database["public"]["Enums"]["peer_connect_unmatched_reason"] | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          custom_service_labels?: NonNullable<Json>;
          cycle_month: string;
          feedback?: string | null;
          id?: string;
          match_id?: string | null;
          member_id: string;
          note?: string | null;
          preferred_countries?: string[];
          preferred_hours_end?: number | null;
          preferred_hours_start?: number | null;
          rating?: number | null;
          service_ids?: string[];
          unmatched_note?: string | null;
          unmatched_reason?: Database["public"]["Enums"]["peer_connect_unmatched_reason"] | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          custom_service_labels?: NonNullable<Json>;
          cycle_month?: string;
          feedback?: string | null;
          id?: string;
          match_id?: string | null;
          member_id?: string;
          note?: string | null;
          preferred_countries?: string[];
          preferred_hours_end?: number | null;
          preferred_hours_start?: number | null;
          rating?: number | null;
          service_ids?: string[];
          unmatched_note?: string | null;
          unmatched_reason?: Database["public"]["Enums"]["peer_connect_unmatched_reason"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "peer_connect_member_preferences_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "peer_connect_matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "peer_connect_member_preferences_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      perks: {
        Row: {
          category: string;
          cover_image_url: string | null;
          created_at: string;
          description: string;
          id: string;
          is_active: boolean;
          is_featured: boolean;
          logo_url: string | null;
          member_coupon_code: string | null;
          member_offer: string | null;
          member_offer_url: string | null;
          name: string;
          offer_expires_at: string | null;
          offer_status: string;
          offer_terms: string | null;
          products: string[];
          slug: string;
          sort_order: number;
          tagline: string;
          updated_at: string;
          user_coupon_code: string | null;
          user_offer: string | null;
          user_offer_url: string | null;
          website_url: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          logo_url?: string | null;
          member_coupon_code?: string | null;
          member_offer?: string | null;
          member_offer_url?: string | null;
          name: string;
          offer_expires_at?: string | null;
          offer_status?: string;
          offer_terms?: string | null;
          products?: string[];
          slug: string;
          sort_order?: number;
          tagline?: string;
          updated_at?: string;
          user_coupon_code?: string | null;
          user_offer?: string | null;
          user_offer_url?: string | null;
          website_url: string;
        };
        Update: {
          category?: string;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          logo_url?: string | null;
          member_coupon_code?: string | null;
          member_offer?: string | null;
          member_offer_url?: string | null;
          name?: string;
          offer_expires_at?: string | null;
          offer_status?: string;
          offer_terms?: string | null;
          products?: string[];
          slug?: string;
          sort_order?: number;
          tagline?: string;
          updated_at?: string;
          user_coupon_code?: string | null;
          user_offer?: string | null;
          user_offer_url?: string | null;
          website_url?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          admin_role: Database["public"]["Enums"]["admin_role"] | null;
          auth_provider: Database["public"]["Enums"]["auth_provider"];
          avatar_url: string | null;
          consent: NonNullable<Json>;
          created_at: string;
          deleted_at: string | null;
          deletion_reason: string | null;
          email: string;
          first_name: string;
          id: string;
          initials: string | null;
          last_login_at: string | null;
          last_name: string;
          phone: string | null;
          phone_country_code: string | null;
          role: Database["public"]["Enums"]["profile_role"];
          status: Database["public"]["Enums"]["profile_status"];
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          admin_role?: Database["public"]["Enums"]["admin_role"] | null;
          auth_provider?: Database["public"]["Enums"]["auth_provider"];
          avatar_url?: string | null;
          consent?: NonNullable<Json>;
          created_at?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
          email: string;
          first_name: string;
          id: string;
          initials?: string | null;
          last_login_at?: string | null;
          last_name: string;
          phone?: string | null;
          phone_country_code?: string | null;
          role?: Database["public"]["Enums"]["profile_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role"] | null;
          auth_provider?: Database["public"]["Enums"]["auth_provider"];
          avatar_url?: string | null;
          consent?: NonNullable<Json>;
          created_at?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
          email?: string;
          first_name?: string;
          id?: string;
          initials?: string | null;
          last_login_at?: string | null;
          last_name?: string;
          phone?: string | null;
          phone_country_code?: string | null;
          role?: Database["public"]["Enums"]["profile_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      search_documents: {
        Row: {
          chunk_index: number;
          city: string | null;
          content: string;
          content_hash: string;
          countries: string[];
          created_at: string;
          doc_date: string;
          doc_type: string;
          embedded_hash: string | null;
          embedding: unknown;
          embedding_model: string | null;
          event_end: string | null;
          event_start: string | null;
          id: number;
          is_available: boolean | null;
          rate_max_cents: number | null;
          rate_min_cents: number | null;
          search_name: string;
          service_ids: string[];
          source_id: string;
          title: string;
          tsv: unknown;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          chunk_index?: number;
          city?: string | null;
          content: string;
          content_hash: string;
          countries?: string[];
          created_at?: string;
          doc_date?: string;
          doc_type: string;
          embedded_hash?: string | null;
          embedding?: unknown;
          embedding_model?: string | null;
          event_end?: string | null;
          event_start?: string | null;
          id?: number;
          is_available?: boolean | null;
          rate_max_cents?: number | null;
          rate_min_cents?: number | null;
          search_name: string;
          service_ids?: string[];
          source_id: string;
          title: string;
          tsv?: never;
          updated_at?: string;
        };
        Update: {
          chunk_index?: number;
          city?: string | null;
          content?: string;
          content_hash?: string;
          countries?: string[];
          created_at?: string;
          doc_date?: string;
          doc_type?: string;
          embedded_hash?: string | null;
          embedding?: unknown;
          embedding_model?: string | null;
          event_end?: string | null;
          event_start?: string | null;
          id?: number;
          is_available?: boolean | null;
          rate_max_cents?: number | null;
          rate_min_cents?: number | null;
          search_name?: string;
          service_ids?: string[];
          source_id?: string;
          title?: string;
          tsv?: never;
          updated_at?: string;
        };
        Relationships: [];
      };
      search_outbox: {
        Row: {
          attempts: number;
          claimed_at: string | null;
          doc_type: string;
          enqueued_at: string;
          failed: boolean;
          id: number;
          last_error: string | null;
          processed_at: string | null;
          source_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          claimed_at?: string | null;
          doc_type: string;
          enqueued_at?: string;
          failed?: boolean;
          id?: never;
          last_error?: string | null;
          processed_at?: string | null;
          source_id: string;
        };
        Update: {
          attempts?: number;
          claimed_at?: string | null;
          doc_type?: string;
          enqueued_at?: string;
          failed?: boolean;
          id?: never;
          last_error?: string | null;
          processed_at?: string | null;
          source_id?: string;
        };
        Relationships: [];
      };
      search_query_log: {
        Row: {
          answer: string | null;
          applied: Json | null;
          created_at: string;
          degraded: string[];
          feedback: number | null;
          feedback_note: string | null;
          id: string;
          ms: number | null;
          plan: Json | null;
          question: string;
          result_refs: NonNullable<Json>;
          source: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          answer?: string | null;
          applied?: Json | null;
          created_at?: string;
          degraded?: string[];
          feedback?: number | null;
          feedback_note?: string | null;
          id?: string;
          ms?: number | null;
          plan?: Json | null;
          question: string;
          result_refs?: NonNullable<Json>;
          source?: string;
          user_id?: string | null;
        };
        Update: {
          answer?: string | null;
          applied?: Json | null;
          created_at?: string;
          degraded?: string[];
          feedback?: number | null;
          feedback_note?: string | null;
          id?: string;
          ms?: number | null;
          plan?: Json | null;
          question?: string;
          result_refs?: NonNullable<Json>;
          source?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      service_anchor_entries: {
        Row: {
          bluff_answer: string;
          created_at: string;
          deliverables: string[];
          id: string;
          instruments: string[];
          practitioner_detail: string;
          service_id: string;
          tools: string[];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bluff_answer: string;
          created_at?: string;
          deliverables?: string[];
          id?: string;
          instruments?: string[];
          practitioner_detail: string;
          service_id: string;
          tools?: string[];
          updated_at?: string;
        };
        Update: {
          bluff_answer?: string;
          created_at?: string;
          deliverables?: string[];
          id?: string;
          instruments?: string[];
          practitioner_detail?: string;
          service_id?: string;
          tools?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_anchor_entries_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      service_lines: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          category_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          is_custom: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_custom?: boolean;
          name: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_custom?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      templates: {
        Row: {
          audiences: string[];
          category: string;
          created_at: string;
          description: string;
          file_name: string;
          file_path: string;
          file_size_bytes: number;
          file_type: string;
          highlights: string[];
          id: string;
          is_active: boolean;
          is_featured: boolean;
          preview_image_url: string | null;
          search_tsv: unknown;
          slug: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          audiences?: string[];
          category: string;
          created_at?: string;
          description?: string;
          file_name: string;
          file_path: string;
          file_size_bytes: number;
          file_type: string;
          highlights?: string[];
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          preview_image_url?: string | null;
          search_tsv?: never;
          slug: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          audiences?: string[];
          category?: string;
          created_at?: string;
          description?: string;
          file_name?: string;
          file_path?: string;
          file_size_bytes?: number;
          file_type?: string;
          highlights?: string[];
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          preview_image_url?: string | null;
          search_tsv?: never;
          slug?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      email_apply_event: {
        Args: {
          p_at: string;
          p_email?: string;
          p_provider_id: string;
          p_status: string;
          p_suppress: boolean;
        };
        Returns: undefined;
      };
      email_claim: {
        Args: { p_lease?: string; p_limit?: number };
        Returns: {
          claimed_at: string;
          id: string;
        }[];
      };
      facet_value_add_source: {
        Args: { p_facet_value_id: string; p_member_id: string };
        Returns: string;
      };
      interview_add_llm_usage: {
        Args: {
          p_cached: number;
          p_input: number;
          p_interview_id: string;
          p_output: number;
          p_role: string;
        };
        Returns: undefined;
      };
      interview_upsert_service_proposal: {
        Args: {
          p_evidence: string;
          p_facet_value_ids: string[];
          p_interview_id: string;
          p_member_id: string;
          p_recency_year: number;
          p_role: number;
          p_scoring_id: string;
          p_service_id: string;
          p_summary: string;
        };
        Returns: boolean;
      };
      member_directory_ids: {
        Args: {
          p_category_id?: string;
          p_countries?: string[];
          p_limit?: number;
          p_offset?: number;
          p_q?: string;
          p_rate_max_cents?: number;
          p_rate_min_cents?: number;
          p_service_ids?: string[];
          p_sort?: string;
        };
        Returns: {
          profile_id: string;
          total_count: number;
        }[];
      };
      record_member_profile_view: {
        Args: { p_slug: string; p_viewer_id?: string };
        Returns: boolean;
      };
      search_enqueue: { Args: { p_id: string; p_type: string }; Returns: undefined };
      search_hybrid: {
        Args: {
          p_city?: string;
          p_countries?: string[];
          p_date_from?: string;
          p_date_to?: string;
          p_doc_types?: string[];
          p_embedding?: string;
          p_limit?: number;
          p_min_similarity?: number;
          p_query?: string;
          p_rate_max_cents?: number;
          p_service_ids?: string[];
        };
        Returns: {
          doc_type: string;
          kw_rank: number;
          name_rank: number;
          score: number;
          source_id: string;
          title: string;
          vec_rank: number;
          vec_sim: number;
        }[];
      };
      search_match_services: {
        Args: { p_limit?: number; p_text: string };
        Returns: {
          category_name: string;
          score: number;
          service_id: string;
          service_name: string;
        }[];
      };
      search_outbox_claim: {
        Args: { p_lease?: string; p_limit?: number };
        Returns: {
          claimed_at: string;
          doc_type: string;
          id: number;
          source_id: string;
        }[];
      };
      search_outbox_complete: {
        Args: { p_claimed_at: string; p_error?: string; p_id: number };
        Returns: undefined;
      };
      search_pending_embeddings: {
        Args: { p_limit?: number };
        Returns: {
          content: string;
          content_hash: string;
          doc_type: string;
          id: number;
          title: string;
        }[];
      };
      search_store_embedding: {
        Args: { p_embedding: string; p_hash: string; p_id: number; p_model: string };
        Returns: boolean;
      };
    };
    Enums: {
      admin_role: "super_admin" | "content_manager" | "reviewer";
      application_region:
        | "asia_pacific"
        | "europe"
        | "latin_america"
        | "middle_east"
        | "north_america"
        | "south_asia"
        | "africa";
      application_status: "draft" | "submitted" | "under_review" | "approved" | "rejected";
      article_status: "draft" | "published" | "pending_review" | "rejected";
      auth_provider: "email" | "linkedin_oidc" | "google";
      billing_period: "monthly" | "annual";
      consent_policy_status: "active" | "inactive";
      consultation_status: "pending" | "completed" | "declined";
      email_message_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed"
        | "cancelled"
        | "suppressed";
      event_status: "draft" | "published";
      facet_kind:
        | "jurisdiction"
        | "instrument"
        | "work_type"
        | "forum"
        | "client_type"
        | "industry"
        | "scale"
        | "volume";
      interview_status:
        | "ready"
        | "in_progress"
        | "interrupted"
        | "processing"
        | "completed"
        | "failed"
        | "voided";
      member_edit_section:
        | "headline_bio"
        | "contact"
        | "engagements"
        | "education"
        | "work_experiences"
        | "key_clients"
        | "testimonials"
        | "awards";
      member_edit_status: "pending" | "verified" | "rejected";
      member_profile_status: "active" | "deactivated";
      membership_tier: "budding_entrepreneur" | "seasoned_professional";
      payment_status: "pending" | "waived" | "paid";
      peer_connect_match_status: "scheduled" | "completed" | "cancelled";
      peer_connect_unmatched_reason:
        | "odd_headcount"
        | "no_compatible_peer"
        | "inactive_member"
        | "other";
      profile_role: "client" | "member" | "admin";
      profile_status: "active" | "suspended" | "deleted";
      renewal_payment_status: "paid" | "pending" | "overdue";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
      application_status: ["draft", "submitted", "under_review", "approved", "rejected"],
      article_status: ["draft", "published", "pending_review", "rejected"],
      auth_provider: ["email", "linkedin_oidc", "google"],
      billing_period: ["monthly", "annual"],
      consent_policy_status: ["active", "inactive"],
      consultation_status: ["pending", "completed", "declined"],
      email_message_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "bounced",
        "complained",
        "failed",
        "cancelled",
        "suppressed",
      ],
      event_status: ["draft", "published"],
      facet_kind: [
        "jurisdiction",
        "instrument",
        "work_type",
        "forum",
        "client_type",
        "industry",
        "scale",
        "volume",
      ],
      interview_status: [
        "ready",
        "in_progress",
        "interrupted",
        "processing",
        "completed",
        "failed",
        "voided",
      ],
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
      profile_role: ["client", "member", "admin"],
      profile_status: ["active", "suspended", "deleted"],
      renewal_payment_status: ["paid", "pending", "overdue"],
    },
  },
} as const;
