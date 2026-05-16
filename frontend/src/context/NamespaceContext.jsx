import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const NamespaceContext = createContext({ public_prefix: "coverage-areas", namespace: "v2" });

export function NamespaceProvider({ children }) {
    const [ns, setNs] = useState({ public_prefix: "coverage-areas", namespace: "v2" });

    useEffect(() => {
        api.get("/component")
            .then(({ data }) => {
                if (data?.public_prefix) setNs({ public_prefix: data.public_prefix, namespace: data.namespace || "v2" });
            })
            .catch(() => {});
    }, []);

    return <NamespaceContext.Provider value={ns}>{children}</NamespaceContext.Provider>;
}

export function useNamespace() {
    return useContext(NamespaceContext);
}
