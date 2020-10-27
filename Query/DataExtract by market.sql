 SELECT A.STD_SKU
      , A.PRODUCT_NAME                                                      AS INVENTORY_PRODUCT_NAME
      , A.PRODUCT_SUPPLIER
      , IFNULL(D.SIZE_NAME, A.PRODUCT_SIZE) AS PRODUCT_SIZE
      , IF(LOCATE('_', REVERSE(A.PRODUCT_COLOR)) > 0, RIGHT(A.PRODUCT_COLOR, LOCATE('_', REVERSE(A.PRODUCT_COLOR)) - 1), A.PRODUCT_COLOR) AS PRODUCT_COLOR
      , A.PRODUCT_DESIGN
      , B.CHANNEL_NAME
      , B.STORE_NANE
      , B.LISTING_SKU
      , B.LISTING_ITEM_ID
      , B.LISTING_PRODUCT_NAME
      , B.LISTING_PRODUCT_QTY
      , B.LISTING_PRODUCT_PRICE
      , B.LISTING_PRODUCT_FBM
      , STR_TO_DATE(B.CREATED_DTTM,'%Y%m%d%H%i%s') AS CREATED_DATE
      , A.VALID_YN
   FROM INVENTORY A
   LEFT OUTER JOIN STD_SIZE D
     ON (A.SIZE_CODE = D.SIZE_CODE)
   JOIN (
       SELECT A.LISTING_ITEM_ID
            , A.STD_SKU
            , A.MARKET_ID
            , A.LISTING_SKU
            , A.LISTING_PRODUCT_NAME
            , A.LISTING_PRODUCT_QTY
            , A.LISTING_PRODUCT_PRICE
            , A.LISTING_PRODUCT_FBM
            , B.CHANNEL_NAME
            , B.BRAND_NAME AS STORE_NANE
            , A.CREATED_DTTM
         FROM LISTING A
            , MARKET B
        WHERE A.MARKET_ID = B.MARKET_ID
#           AND A.VALID_YN = 'Y'
       ) B
     ON (A.STD_SKU = B.STD_SKU)
#   WHERE A.VALID_YN = 'Y'
  UNION
 SELECT A.STD_SKU
      , A.PRODUCT_NAME                                                      AS INVENTORY_PRODUCT_NAME
      , A.PRODUCT_SUPPLIER
      , IFNULL(D.SIZE_NAME, A.PRODUCT_SIZE) AS PRODUCT_SIZE
      , IF(LOCATE('_', REVERSE(A.PRODUCT_COLOR)) > 0, RIGHT(A.PRODUCT_COLOR, LOCATE('_', REVERSE(A.PRODUCT_COLOR)) - 1), A.PRODUCT_COLOR) AS PRODUCT_COLOR
      , A.PRODUCT_DESIGN
      , ''
      , ''
      , ''
      , ''
      , ''
      , ''
      , ''
      , ''
      , NULL
      , A.VALID_YN
   FROM INVENTORY A
   LEFT OUTER JOIN STD_SIZE D
     ON (A.SIZE_CODE = D.SIZE_CODE)
#   WHERE A.VALID_YN = 'Y'
    AND NOT EXISTS (
        SELECT 1
          FROM LISTING B
         WHERE A.STD_SKU = B.STD_SKU
#            AND B.VALID_YN = 'Y'
      )
;

 SELECT A.STD_SKU
      , MAX(IF(A.RN = 1, A.IMAGE_PATH, '')) AS IMAGE_1
      , MAX(IF(A.RN = 2, A.IMAGE_PATH, '')) AS IMAGE_2
      , MAX(IF(A.RN = 3, A.IMAGE_PATH, '')) AS IMAGE_3
      , MAX(IF(A.RN = 4, A.IMAGE_PATH, '')) AS IMAGE_4
      , MAX(IF(A.RN = 5, A.IMAGE_PATH, '')) AS IMAGE_5
      , MAX(IF(A.RN = 6, A.IMAGE_PATH, '')) AS IMAGE_6
      , MAX(IF(A.RN = 7, A.IMAGE_PATH, '')) AS IMAGE_7
      , MAX(IF(A.RN = 8, A.IMAGE_PATH, '')) AS IMAGE_8
      , MAX(IF(A.RN = 9, A.IMAGE_PATH, '')) AS IMAGE_9
      , MAX(IF(A.RN = 10, A.IMAGE_PATH, '')) AS IMAGE_10
   FROM (
            SELECT A.STD_SKU
                 , B.IMAGE_PATH
                 , ROW_NUMBER() OVER (PARTITION BY A.STD_SKU ORDER BY B.IMAGE_ID) AS RN
            FROM INVENTORY A
               , IMAGE B
            WHERE A.STD_SKU = B.SKU
              AND A.VALID_YN = 'Y'
        ) A
  WHERE RN <= 10
  GROUP BY A.STD_SKU