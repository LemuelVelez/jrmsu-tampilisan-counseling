import React from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MessageCircle, BookOpen, ArrowRight } from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import Loading from "@/components/Loading";
import { useSession } from "@/hooks/use-session";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const StudentOverview: React.FC = () => {
    const { session, status } = useSession();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (status === "unauthenticated") {
            navigate("/auth", { replace: true });
        }
    }, [status, navigate]);

    if (status === "loading") {
        return (
            <DashboardLayout title="Loading…">
                <div className="flex flex-1 items-center justify-center">
                    <Loading />
                </div>
            </DashboardLayout>
        );
    }

    const name =
        (session?.user?.name || session?.user?.email || "Student").toString();
    const firstName = name.split(/\s+/)[0] || "Student";

    return (
        <DashboardLayout
            title={`Welcome back, ${firstName}`}
            description="Track your counseling appointments, requests, and helpful resources."
        >
            {/* Top highlight cards */}
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-amber-100/80 bg-amber-50/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Next appointment
                        </CardTitle>
                        <Calendar className="h-4 w-4 text-amber-700" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-amber-900">
                            You have no upcoming counseling appointments.
                        </p>
                        <p className="mt-1 text-xs text-amber-900/70">
                            When you book a session, it will appear here with the
                            date, time, and counselor details.
                        </p>
                        <Button
                            size="sm"
                            className="mt-3"
                            onClick={() =>
                                navigate("/dashboard/student/appointments")
                            }
                        >
                            Book an appointment
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Support requests
                        </CardTitle>
                        <MessageCircle className="h-4 w-4 text-emerald-700" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">0</p>
                        <p className="text-xs text-muted-foreground">
                            You don&apos;t have any open counseling requests
                            right now.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() =>
                                navigate("/dashboard/student/requests")
                            }
                        >
                            View request history
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Self-help resources
                        </CardTitle>
                        <BookOpen className="h-4 w-4 text-blue-700" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">
                            Explore articles and guides about stress management,
                            study habits, and mental wellness.
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 px-0 text-xs font-medium"
                            onClick={() =>
                                navigate("/dashboard/student/resources")
                            }
                        >
                            Browse resources
                            <ArrowRight className="ml-1.5 h-3 w-3" />
                        </Button>
                    </CardContent>
                </Card>
            </section>

            {/* Lower section: simple layout for now */}
            <section className="grid gap-4 lg:grid-cols-[2fr,1.2fr]">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            Recent activity
                        </CardTitle>
                        <CardDescription>
                            A quick summary of your most recent counseling
                            interactions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        <p className="mb-1">
                            You haven&apos;t started any counseling sessions
                            yet.
                        </p>
                        <p>
                            When you submit a request, book an appointment, or
                            chat with a counselor, the latest details will
                            appear here so you can review them at a glance.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            Need immediate support?
                        </CardTitle>
                        <CardDescription>
                            If you&apos;re in crisis and need urgent help,
                            please contact your local emergency services.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                        <p>
                            The eCounseling platform is for non-emergency
                            support such as academic stress, time management,
                            and personal concerns.
                        </p>
                        <p>
                            For emergencies, reach out directly to campus
                            authorities or emergency hotlines available in your
                            area.
                        </p>
                    </CardContent>
                </Card>
            </section>
        </DashboardLayout>
    );
};

export default StudentOverview;
