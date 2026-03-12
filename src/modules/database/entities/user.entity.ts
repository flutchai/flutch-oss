import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { UserIdentity } from "./user-identity.entity";
import { Thread } from "./thread.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToMany(() => UserIdentity, (identity) => identity.user, { cascade: true })
  identities: UserIdentity[];

  @OneToMany(() => Thread, (thread) => thread.user)
  threads: Thread[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
