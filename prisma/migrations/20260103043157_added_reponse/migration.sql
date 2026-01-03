-- CreateTable
CREATE TABLE "DigResponse" (
    "id" TEXT NOT NULL,
    "dig_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "layer_id" TEXT NOT NULL,
    "response" TEXT,
    "is_correct" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigResponse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DigResponse" ADD CONSTRAINT "DigResponse_dig_id_fkey" FOREIGN KEY ("dig_id") REFERENCES "digs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigResponse" ADD CONSTRAINT "DigResponse_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
