SELECT IFNULL(ORDER_SEQ, 0) + 1 AS ORDER_SEQ
  FROM (
            SELECT ?              AS ORDER_DATE
                 , max(ORDER_SEQ) AS ORDER_SEQ
              FROM PRODUCT_ORDER
             WHERE ORDER_DATE = ?
       ) A