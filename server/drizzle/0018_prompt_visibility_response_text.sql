-- Add response_text column to store the full AI engine response for debugging and display
ALTER TABLE "prompt_visibility_results" ADD COLUMN "response_text" text;
