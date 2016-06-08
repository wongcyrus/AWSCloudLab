package com.cloudlabhk.scheduler;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URL;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.joda.time.DateTime;
import org.joda.time.Interval;

import net.fortuna.ical4j.data.CalendarBuilder;
import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.CalendarException;
import net.fortuna.ical4j.model.Component;
import net.fortuna.ical4j.model.Period;
import net.fortuna.ical4j.model.PeriodList;
import net.fortuna.ical4j.model.Property;
import net.fortuna.ical4j.model.PropertyList;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.DtEnd;
import net.fortuna.ical4j.model.property.DtStart;
import net.fortuna.ical4j.model.property.Duration;
import net.fortuna.ical4j.model.property.RRule;

public class CalenderReader {

    public List<Lab> getComingLab(String icsUri, String teacher) throws IOException, ParserException {
        CalendarBuilder builder = new CalendarBuilder();

        URL calUri = new URL(icsUri);
        BufferedReader in = new BufferedReader(new InputStreamReader(calUri.openStream()));

        Calendar calendar = builder.build(in);

        CalenderReader calenderReader = new CalenderReader();
        DateTime now = DateTime.now();
        DateTime classStartTime = now.plusMinutes(30);
        //now.plusDays(10);
        // nowHere.plusMinutes(30);
        Set<VEvent> vEvents = calenderReader.convertCalendarToEvents(calendar, new Interval(now, classStartTime));

        return vEvents.stream().map(c -> {
            Lab lab = new Lab();
            DateTime startTime = new DateTime(c.getStartDate().getDate());
            DateTime endTime = new DateTime(c.getEndDate().getDate());

            String labKey = c.getSummary().getValue() + " (" + teacher + ") {Start:"
                    + startTime + ",End:" + endTime + "}";
            labKey = labKey.replaceAll("[^A-Za-z0-9]", "");
            lab.setId(labKey);
            lab.setTeacher(teacher);
            lab.setCourse(c.getSummary().getValue());
            lab.setStartDateTime(startTime.getMillis());
            lab.setEndDateTime(endTime.getMillis());
            lab.setDescription(c.getSummary().getValue() + "\nLocation:" + c.getLocation() + "\nTeacher:" + teacher);
            return lab;
        }).collect(Collectors.toList());

    }

    // From project CalendarPortlet, under directory
    // /src/main/java/org/jasig/portlet/calendar/adapter/, in source file
    // CalDavCalendarAdapter.java
    protected Set<VEvent> convertCalendarToEvents(net.fortuna.ical4j.model.Calendar calendar, Interval interval)
            throws CalendarException {
        Period period = new Period(new net.fortuna.ical4j.model.DateTime(interval.getStartMillis()),
                new net.fortuna.ical4j.model.DateTime(interval.getEndMillis()));
        Set<VEvent> events = new HashSet<VEvent>();
        if (calendar == null) {
            System.out.println("calendar empty, returning empty set");
            return Collections.emptySet();
        }
        for (Iterator<Component> i = calendar.getComponents().iterator(); i.hasNext(); ) {
            Component component = i.next();
            if (component.getName().equals("VEVENT")) {
                VEvent event = (VEvent) component;
                PeriodList periods = event.calculateRecurrenceSet(period);
                for (Iterator<Period> iter = periods.iterator(); iter.hasNext(); ) {
                    Period eventper = iter.next();
                    PropertyList props = event.getProperties();
                    PropertyList newprops = new PropertyList();
                    newprops.add(new DtStart(eventper.getStart()));
                    newprops.add(new DtEnd(eventper.getEnd()));
                    for (Iterator<Property> iter2 = props.iterator(); iter2.hasNext(); ) {
                        Property prop = iter2.next();
                        if (!(prop instanceof DtStart) && !(prop instanceof DtEnd) && !(prop instanceof Duration)
                                && !(prop instanceof RRule))
                            newprops.add(prop);
                    }
                    VEvent newevent = new VEvent(newprops);
                    events.add(newevent);
                    // System.out.println("added event " + newevent);
                }
            }
        }
        return events;
    }

}
