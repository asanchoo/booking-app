UPDATE services
SET name = 'Маникюр',
    description = CASE
      WHEN trim(COALESCE(description, '')) = '' OR lower(trim(description)) = 'manik'
        THEN 'Уход за ногтями и кутикулой.'
      ELSE description
    END
WHERE lower(trim(name)) = 'manik';
