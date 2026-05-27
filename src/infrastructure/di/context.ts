/**
 * DI 容器 — 单例/工厂注册 + 链式插件 + 懒加载解析
 *
 * 使用模式:
 *   const ctx = createContext()
 *     .use(registerA)
 *     .use(registerB)
 *     .build();
 *   const svc = ctx.get<SomeType>('someService');
 */
export type Plugin = (c: AppContext) => void;
export type Factory<T> = (c: AppContext) => T;

/** 内部依赖定义 */
interface Def {
  name: string;
  factory: Factory<unknown>;
  singleton: boolean;
  instance?: unknown;
}

export class AppContext {
  private defs = new Map<string, Def>();
  private plugins: Plugin[] = [];
  private built = false;
  private resolving: string[] = [];

  /** 注册单例 — 首次 get 时创建，之后缓存同一实例 */
  singleton<T>(name: string, factory: Factory<T>): this {
    if (this.built) throw new Error(`容器已 build，无法注册: ${name}`);
    if (this.defs.has(name)) throw new Error(`依赖已注册: ${name}`);
    this.defs.set(name, { name, factory: factory as Factory<unknown>, singleton: true });
    return this;
  }

  /** 注册工厂 — 每次 get 都创建新实例 */
  factory<T>(name: string, factory: Factory<T>): this {
    if (this.built) throw new Error(`容器已 build，无法注册: ${name}`);
    if (this.defs.has(name)) throw new Error(`依赖已注册: ${name}`);
    this.defs.set(name, { name, factory: factory as Factory<unknown>, singleton: false });
    return this;
  }

  /** 解析依赖 — 懒加载，首次被请求时才从工厂创建 */
  get<T>(name: string): T {
    const def = this.defs.get(name);
    if (!def) {
      throw new Error(
        `未注册的依赖: "${name}"。已注册: [${Array.from(this.defs.keys()).join(', ')}]`
      );
    }

    if (this.resolving.includes(name)) {
      const chain = [...this.resolving, name].join(' → ');
      throw new Error(`循环依赖检测: ${chain}`);
    }

    if (def.singleton && def.instance !== undefined) {
      return def.instance as T;
    }

    this.resolving.push(name);
    try {
      const instance = def.factory(this);
      if (def.singleton) def.instance = instance;
      return instance as T;
    } finally {
      this.resolving.pop();
    }
  }

  /** 链式注册插件 — 插件在 build() 时统一执行 */
  use(plugin: Plugin): this {
    if (this.built) throw new Error(`容器已 build，无法添加插件`);
    this.plugins.push(plugin);
    return this;
  }

  /** 执行所有插件完成注册 */
  build(): this {
    if (this.built) return this;
    for (const plugin of this.plugins) {
      plugin(this);
    }
    this.built = true;
    return this;
  }
}

/** 创建空容器 */
export function createContext(): AppContext {
  return new AppContext();
}
