begin;

revoke update on public.user_settings from authenticated;

create or replace function public.complete_onboarding(
  onboarding_handle text,
  onboarding_display_name text,
  onboarding_birth_date date,
  onboarding_country_code text,
  onboarding_languages text[]
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_handle text := lower(trim(onboarding_handle));
  normalized_display_name text := trim(onboarding_display_name);
  normalized_country_code text := nullif(upper(trim(onboarding_country_code)), '');
  updated_profile public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if onboarding_birth_date is null
     or onboarding_birth_date > (current_date - interval '18 years')::date then
    raise exception 'You must be at least 18 years old' using errcode = '22023';
  end if;

  if normalized_handle !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must contain 3-24 lowercase letters, numbers, or underscores'
      using errcode = '22023';
  end if;

  if char_length(normalized_display_name) not between 2 and 50 then
    raise exception 'Display name must contain 2-50 characters' using errcode = '22023';
  end if;

  if normalized_country_code is not null and normalized_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Country code must contain two letters' using errcode = '22023';
  end if;

  if onboarding_languages is null
     or cardinality(onboarding_languages) < 1
     or cardinality(onboarding_languages) > 8 then
    raise exception 'Choose between one and eight languages' using errcode = '22023';
  end if;

  update public.profiles
  set handle = normalized_handle,
      display_name = normalized_display_name,
      country_code = normalized_country_code,
      languages = onboarding_languages
  where id = current_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile record is missing' using errcode = 'P0002';
  end if;

  update public.user_settings
  set date_of_birth = onboarding_birth_date,
      age_verified_at = now(),
      terms_accepted_at = coalesce(terms_accepted_at, now()),
      community_guidelines_accepted_at = coalesce(community_guidelines_accepted_at, now()),
      onboarding_completed_at = now()
  where id = current_user_id;

  return updated_profile;
end;
$$;

revoke all on function public.complete_onboarding(text, text, date, text, text[]) from public, anon;
grant execute on function public.complete_onboarding(text, text, date, text, text[]) to authenticated;

commit;
