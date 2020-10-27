SELECT A.STD_SKU
     , A.PRODUCT_CODE
     , A.SIZE
     , A.COLOR
     , A.NAME
     , AA.IMAGE_PATH
  FROM (
           SELECT A.STD_SKU
                , A.PRODUCT_CODE
                , A.SIZE
                , A.COLOR
                , A.NAME
                , AA.IMAGE_PATH
                , MIN(AA.IMAGE_ID) AS IMAGE_ID
           FROM (
                    SELECT A.STD_SKU                                       AS STD_SKU
                         , SUBSTRING_INDEX(A.STD_SKU, '-', 1)              AS PRODUCT_CODE
                         , IFNULL(AA.SIZE_NAME, A.PRODUCT_SIZE)            AS SIZE
                         , TRIM(SUBSTRING_INDEX(A.PRODUCT_COLOR, '_', -1)) AS COLOR
                         , A.PRODUCT_NAME                                  AS NAME
                    FROM INVENTORY A
                    LEFT OUTER JOIN STD_SIZE AA ON (A.SIZE_CODE = AA.SIZE_CODE)
                    WHERE POSITION('-' IN A.STD_SKU) > 0
                      AND A.STD_SKU LIKE CONCAT(?, '%')
                ) A
           LEFT OUTER JOIN IMAGE AA ON (A.STD_SKU = AA.SKU)
           GROUP BY A.STD_SKU
                  , A.PRODUCT_CODE
                  , A.SIZE
                  , A.COLOR
                  , A.NAME
       ) A
  LEFT OUTER JOIN IMAGE AA ON (A.IMAGE_ID = AA.IMAGE_ID)