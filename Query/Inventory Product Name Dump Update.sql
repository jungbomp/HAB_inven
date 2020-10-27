 UPDATE INVENTORY A
    SET A.PRODUCT_NAME = TRIM(SUBSTR(A.PRODUCT_NAME FROM 1 FOR position('SIZE:' in UPPER(A.PRODUCT_NAME)) - 1))
  WHERE position('SIZE:' in UPPER(A.PRODUCT_NAME)) > 0
;

 UPDATE INVENTORY A
    SET A.PRODUCT_NAME = TRIM(SUBSTR(A.PRODUCT_NAME FROM 1 FOR POSITION('(' IN A.PRODUCT_NAME) -1))
  WHERE position(',' in UPPER(A.PRODUCT_NAME)) > 0
    AND PRODUCT_NAME != 'HC Womens Sleeveless T-Shirts, Round-Bottom'
    AND PRODUCT_NAME != 'MP Instant Hand Saniziter (70% Ethanol, 500ml (16.9oz))'
    AND PRODUCT_NAME != 'WO Hand Gel Sanitizer (72% Ethanol, 500ml (16.9oz))'
    AND PRODUCT_NAME != 'Reusable Cotton/Spandex Mask - Black, 3P'
    AND PRODUCT_NAME != 'PI Mens Super Slim Stretch Jeans PMD040023R, PMD029023R'
    AND PRODUCT_NAME NOT LIKE 'SM Mens Premium Cargo Shorts (30-42)%'
    AND PRODUCT_NAME NOT LIKE 'Mens Crew Neck Short Sleeve T Shirts%'
    AND PRODUCT_NAME NOT LIKE 'Unisex Fleece Sweat Shorts%'
    AND PRODUCT_NAME NOT LIKE 'Mens Twill Cargo Shorts with Belt (30-40)%'
    AND PRODUCT_NAME NOT LIKE 'Womens Fur Lined Belted Coat (GJ1133)%'
;

 UPDATE INVENTORY A
    SET A.PRODUCT_NAME = TRIM(CONCAT(SUBSTRING_INDEX(A.PRODUCT_NAME, ')', 1), ')'))
  WHERE position(',' in UPPER(A.PRODUCT_NAME)) > 0
    AND PRODUCT_NAME != 'HC Womens Sleeveless T-Shirts, Round-Bottom'
    AND PRODUCT_NAME != 'MP Instant Hand Saniziter (70% Ethanol, 500ml (16.9oz))'
    AND PRODUCT_NAME != 'WO Hand Gel Sanitizer (72% Ethanol, 500ml (16.9oz))'
    AND PRODUCT_NAME != 'Reusable Cotton/Spandex Mask - Black, 3P'
    AND PRODUCT_NAME != 'PI Mens Super Slim Stretch Jeans PMD040023R, PMD029023R'
;

