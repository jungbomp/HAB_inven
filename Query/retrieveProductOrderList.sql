 SELECT A.ORDER_DATE
      , A.ORDER_SEQ
      , IFNULL(BB.VENDOR_NAME, AA.BRAND_NAME)                                   AS VENDOR_NAME
      , A.PRODUCT_CODE
      , B.PRODUCT_TITLE
      , SUM(A.ORDER_QTY)                                                        AS TOTAL_QTY
      , TRIM(CONCAT(IFNULL(CC.FIRST_NAME, ' '), ' ', IFNULL(CC.LAST_NAME, ''))) AS STAFF
      , IFNULL(DD.MANUFACTURING_CODE, '')                                       AS MANUFACTURING_CODE
   FROM PRODUCT_ORDER A
   LEFT OUTER JOIN BRAND AA
     ON (A.BRAND_CODE  = AA.BRAND_CODE)
   LEFT OUTER JOIN VENDOR BB
     ON (A.VENDOR_CODE = BB.VENDOR_CODE)
   LEFT OUTER JOIN `USER` CC
     ON (A.EMPLOYEE_ID = CC.EMPLOYEE_ID)
   LEFT OUTER JOIN MANUFACTURING_MAP DD
     ON (A.PRODUCT_CODE = DD.PRODUCT_CODE
    AND A.STD_SKU       = DD.STD_SKU)
      , PRODUCT B
  WHERE A.PRODUCT_CODE = B.PRODUCT_CODE
    AND A.ORDER_DATE  >= ?
    AND A.ORDER_DATE  <= ?
  GROUP BY A.ORDER_DATE
      , A.ORDER_SEQ
      , IFNULL(AA.BRAND_NAME, BB.VENDOR_NAME)
      , A.PRODUCT_CODE
      , B.PRODUCT_TITLE
      , TRIM(CONCAT(IFNULL(CC.FIRST_NAME, ' '), ' ', IFNULL(CC.LAST_NAME, '')))
  ORDER BY A.ORDER_DATE DESC
      , A.ORDER_SEQ DESC