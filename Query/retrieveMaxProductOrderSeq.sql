SELECT ?                             AS ORDER_DATE
     , IFNULL(MAX(ORDER_SEQ), 0) + 1 AS ORDER_SEQ
  FROM PRODUCT_ORDER